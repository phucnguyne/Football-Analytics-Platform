import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@app/database";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";
import { reserveLoginAttempt, resetLoginAttempts } from "@/lib/login-rate-limit";

// Run bcrypt even when there is no password hash for the submitted email.
const DUMMY_PASSWORD_HASH = "$2a$12$laHubqfXPTnNjGEGecyZseOwMS5lVMJi.s4CdZeF.Zsr29nAoQ2jW";

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password = credentials?.password;
        if (!email || email.length > 254 || typeof password !== "string" || !password) {
          return null;
        }

        try {
          const attempt = await reserveLoginAttempt(email, request.headers);
          if (!attempt) return null;

          const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, username: true, password: true },
          });

          const isMatch = await bcrypt.compare(password, user?.password || DUMMY_PASSWORD_HASH);
          if (!user?.password || !isMatch) return null;

          await resetLoginAttempts(attempt);
          return { id: user.id, email: user.email, name: user.username };
        } catch (error) {
          console.error("Credentials sign-in failed", error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    }
  },
  pages: {
    signIn: "/login",
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@app/database";
import bcrypt from "bcryptjs";
import { env } from "@/lib/env";
import { reserveLoginAttempt, resetLoginAttempts } from "@/lib/login-rate-limit";

// Run bcrypt even when there is no password hash for the submitted email.
const DUMMY_PASSWORD_HASH = "$2a$12$laHubqfXPTnNjGEGecyZseOwMS5lVMJi.s4CdZeF.Zsr29nAoQ2jW";

const IDLE_SECONDS = 8 * 60 * 60;
const ABSOLUTE_SECONDS = 7 * 24 * 60 * 60;

function sessionKey(sid: string) {
  return createHash("sha256").update(sid).digest("hex");
}

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
        if (!email || email.length > 254 || typeof password !== "string" || !password || Buffer.byteLength(password) > 72) {
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
          console.error("Credentials sign-in failed", error instanceof Error ? error.name : "UnknownError");
          return null;
        }
      }
    })
  ],
  useSecureCookies: new URL(env.NEXTAUTH_URL).protocol === "https:",
  session: {
    strategy: "jwt",
    maxAge: IDLE_SECONDS,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const sid = randomUUID();
        const now = new Date();
        const expires = new Date(now.getTime() + ABSOLUTE_SECONDS * 1000);
        await prisma.$transaction([
          prisma.session.deleteMany({ where: { userId: user.id, expires: { lte: now } } }),
          prisma.session.create({ data: { sessionToken: sessionKey(sid), userId: user.id, expires } }),
        ]);
        return { sub: user.id, sid };
      }

      if (!token.sid || !token.sub) throw new Error("Invalid session");
      const active = await prisma.session.findUnique({
        where: { sessionToken: sessionKey(token.sid) },
        select: {
          expires: true,
          user: { select: { id: true, email: true, username: true, avatar: true, role: true } },
        },
      });
      if (!active || active.user.id !== token.sub || active.expires.getTime() <= Date.now()) {
        throw new Error("Invalid session");
      }

      return {
        sub: active.user.id,
        sid: token.sid,
        email: active.user.email,
        name: active.user.username,
        picture: active.user.avatar,
        role: active.user.role,
        absoluteExpires: active.expires.getTime(),
      };
    },
    async session({ session, token }) {
      return {
        expires: new Date(Math.min(Date.parse(session.expires), token.absoluteExpires!)).toISOString(),
        user: { id: token.sub!, email: token.email, name: token.name, image: token.picture, role: token.role! },
      };
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.sid && token.sub) {
        await prisma.session.deleteMany({ where: { sessionToken: sessionKey(token.sid), userId: token.sub } });
      }
    },
  },
  logger: {
    error(code) { console.error("NextAuth error:", code); },
  },
  pages: {
    signIn: "/login",
  }
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

export async function getUserId() {
  return (await getCurrentUser())?.id ?? null;
}

import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { listAppDocuments, type AppDocument } from "@/lib/app-data";
import { getDatabase } from "@/lib/mongodb";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        try {
          const matches = await listAppDocuments<AppDocument & {
            name?: string;
            email?: string;
            passwordHash?: string;
          }>("users", { email }, () => getDatabase().collection("users").find({ email }).limit(1).toArray(), 1);
          const user = matches[0];
          if (!user || typeof user.passwordHash !== "string" || !(await bcrypt.compare(password, user.passwordHash))) return null;
          return { id: user._id.toString(), name: user.name || user.email || "Người dùng", email: user.email || email };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

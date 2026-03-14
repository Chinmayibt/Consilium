import { api } from "./client";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "manager" | "member";
  github_link?: string | null;
  skills: string[];
  avatar_initials?: string | null;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: UserProfile;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const params = new URLSearchParams();
  params.append("username", email);
  params.append("password", password);
  params.append("grant_type", "password");

  const { data } = await api.post<AuthResponse>("/auth/login", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  role: "manager" | "member";
  github_link?: string;
  skills: string[];
}

export async function signup(payload: SignupPayload): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>("/auth/signup", payload);
  return data;
}


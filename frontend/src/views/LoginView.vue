<!--
  LoginView: split screen — beach photo with the tagline on the left, sign-in form on the right.
  On small screens the photo becomes a short banner above the form.

  - "Demo accounts" buttons fill the form with a seeded account and sign in at once.
  - A wrong password shows the API message ("Invalid email or password.") on the form:
    the Axios 401 interceptor deliberately ignores the login request.
  - After login, the user goes back to the page they asked for (?redirect=...), or to their home page.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import beachImage from "@/assets/images/login-beach.jpg";
import Spinner from "@/components/Spinner.vue";
import { homeRouteFor } from "@/router";
import { useAuthStore } from "@/stores/auth";
import { getErrorMessage } from "@/utils/api-errors";

// Seeded accounts (see the README); they all share the same password.
const DEMO_PASSWORD = "password";
const DEMO_ACCOUNTS = [
  { label: "Requester", email: "maya.levi@example.com" },
  { label: "Validator", email: "sarah.manager@example.com" },
];

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref("");
const password = ref("");
const submitting = ref(false);
const errorMessage = ref<string | null>(null);

// Set by the 401 interceptor when a session expires.
const sessionExpired = computed(() => route.query.reason === "expired" && !errorMessage.value);

// Only accepts internal paths ("/my-requests"), never another site ("//evil.com", "https://...").
function safeRedirect(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

async function submit(): Promise<void> {
  if (submitting.value) return;
  errorMessage.value = null;

  if (!email.value.trim() || !password.value) {
    errorMessage.value = "Please enter your email and password.";
    return;
  }

  submitting.value = true;
  try {
    await auth.login(email.value.trim(), password.value);
    await router.replace(safeRedirect(route.query.redirect) ?? homeRouteFor(auth.user!.role));
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Sign in failed. Please try again.");
  } finally {
    submitting.value = false;
  }
}

// Fills the form with a demo account and signs in.
function signInAs(accountEmail: string): void {
  email.value = accountEmail;
  password.value = DEMO_PASSWORD;
  submit();
}
</script>

<template>
  <div class="min-h-screen bg-sand-50 lg:grid lg:grid-cols-2">
    <!-- Photo panel -->
    <aside class="relative isolate h-40 overflow-hidden sm:h-56 lg:h-auto lg:min-h-screen">
      <img
        :src="beachImage"
        alt="Calm turquoise sea and a sandy beach at sunset"
        class="absolute inset-0 -z-20 size-full object-cover object-[30%_center]"
      />
      <div class="absolute inset-0 -z-10 bg-gradient-to-t from-stone-900/55 via-stone-900/5 to-transparent" />
      <div class="flex h-full flex-col justify-end p-5 sm:p-8 lg:p-12">
        <p class="font-display text-3xl leading-tight text-white sm:text-4xl lg:text-5xl">Time off, made simple.</p>
        <p class="mt-1 text-sm text-white/90 sm:text-base">Plan your next break and keep your team in sync.</p>
      </div>
    </aside>

    <!-- Sign-in panel -->
    <main class="flex items-center justify-center px-5 py-8 sm:px-8 lg:py-0">
      <div class="w-full max-w-sm">
        <p class="font-display text-3xl text-brand-600">Away</p>
        <h1 class="mt-4 text-xl font-semibold text-stone-900">Welcome back</h1>
        <p class="mt-0.5 text-sm text-stone-500">Sign in to manage vacation requests.</p>

        <div
          v-if="sessionExpired"
          class="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="status"
        >
          Your session has expired. Please sign in again.
        </div>

        <div
          v-if="errorMessage"
          class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {{ errorMessage }}
        </div>

        <form class="mt-5 space-y-4" novalidate @submit.prevent="submit">
          <div>
            <label for="email" class="field-label">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="username"
              class="field-input"
              :disabled="submitting"
            />
          </div>
          <div>
            <label for="password" class="field-label">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="field-input"
              :disabled="submitting"
            />
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="submitting">
            <Spinner v-if="submitting" class="size-4" />
            {{ submitting ? "Signing in…" : "Sign in" }}
          </button>
        </form>

        <div class="mt-5 rounded-2xl bg-sand-100 p-4">
          <p class="text-sm text-stone-600">
            Demo accounts (password: <span class="font-semibold text-stone-800">{{ DEMO_PASSWORD }}</span>)
          </p>
          <div class="mt-3 grid grid-cols-2 gap-3">
            <button
              v-for="account in DEMO_ACCOUNTS"
              :key="account.email"
              type="button"
              class="btn-secondary"
              :disabled="submitting"
              :title="account.email"
              @click="signInAs(account.email)"
            >
              {{ account.label }}
            </button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

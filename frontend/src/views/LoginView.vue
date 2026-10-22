<!--
  LoginView: split screen — beach photo with the tagline on the left, sign-in form on the right.
  On small screens the photo becomes a short banner above the form.

  - Demo accounts are listed in the README (they are not shown on the screen).
  - A wrong password shows the API message ("Invalid email or password.") on the form:
    the Axios 401 interceptor deliberately ignores the login request.
  - After login, the user goes back to the page they asked for (?redirect=...), or to their home page.
-->
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import beachImage from "@/assets/images/login-beach.jpg";
import Spinner from "@/components/Spinner.vue";
import { homeRouteFor } from "@/router";
import { useAuthStore } from "@/stores/auth";
import { getErrorMessage } from "@/utils/api-errors";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref("");
const password = ref("");
// Toggled by the eye button: shows the password in clear text while true. Hidden by default.
const showPassword = ref(false);

// When the field is emptied, the eye disappears and the next password starts hidden again.
watch(password, (value) => {
  if (!value) showPassword.value = false;
});
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
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                class="field-input pr-11"
                :disabled="submitting"
              />
              <!-- Eye button: shows / hides the password. Visible only when the field has text.
                   The icon reflects the current state: closed eye = hidden (dots), open eye = visible.
                   Screen readers get the state from aria-pressed. -->
              <button
                v-if="password"
                type="button"
                class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-stone-400 transition hover:text-stone-600 focus-visible:text-brand-600 focus-visible:outline-none"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                :aria-pressed="showPassword"
                :title="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <!-- Open eye: the password is visible -->
                <svg v-if="showPassword" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <!-- Closed (crossed-out) eye: the password is hidden — the default -->
                <svg v-else class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5" />
                  <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  <path d="m2 2 20 20" />
                </svg>
              </button>
            </div>
          </div>
          <button type="submit" class="btn-primary w-full" :disabled="submitting">
            <Spinner v-if="submitting" class="size-4" />
            {{ submitting ? "Signing in…" : "Sign in" }}
          </button>
        </form>
      </div>
    </main>
  </div>
</template>

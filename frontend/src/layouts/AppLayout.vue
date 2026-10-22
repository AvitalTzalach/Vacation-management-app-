<!--
  AppLayout: frame of every signed-in page.
  A landscape hero banner holds the logo, the navigation (by role), the user's name and role,
  and the page title / subtitle (from the route meta). The page itself renders below.
-->
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import heroImage from "@/assets/images/login-beach.jpg";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

interface NavItem {
  label: string;
  to: RouteLocationRaw;
}

// Navigation depends on the role: requesters see their requests, validators the dashboard.
const navItems = computed<NavItem[]>(() =>
  auth.user?.role === "Validator"
    ? [{ label: "Dashboard", to: { name: "dashboard" } }]
    : [{ label: "My requests", to: { name: "my-requests" } }]
);

function signOut(): void {
  auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="min-h-screen pb-16">
    <header class="relative isolate overflow-hidden">
      <img
        :src="heroImage"
        alt=""
        class="absolute inset-0 -z-20 size-full object-cover object-[center_45%]"
      />
      <!-- Darkens the photo so white text stays readable. -->
      <div class="absolute inset-0 -z-10 bg-gradient-to-b from-stone-900/45 via-stone-900/20 to-stone-900/50" />

      <div class="mx-auto max-w-6xl px-5 pt-6 pb-12 sm:px-8 sm:pb-14">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <RouterLink :to="{ name: 'home' }" class="font-display text-3xl text-white">Away</RouterLink>

          <nav class="flex flex-wrap items-center gap-1 text-sm text-white/90" aria-label="Main">
            <RouterLink
              v-for="item in navItems"
              :key="item.label"
              :to="item.to"
              class="rounded-full px-4 py-2 transition hover:bg-white/15"
              active-class="bg-white/25 text-white backdrop-blur-sm"
            >
              {{ item.label }}
            </RouterLink>
            <button type="button" class="rounded-full px-4 py-2 transition hover:bg-white/15" @click="signOut">
              Sign out
            </button>
          </nav>
        </div>

        <div class="mt-14 sm:mt-20">
          <p v-if="auth.user" class="text-sm font-medium text-white/85">
            {{ auth.user.name }} · {{ auth.user.role }}
          </p>
          <h1 class="font-display mt-1 text-5xl leading-tight text-white sm:text-6xl">{{ route.meta.title }}</h1>
          <p v-if="route.meta.subtitle" class="mt-1 text-white/90">{{ route.meta.subtitle }}</p>
        </div>
      </div>
    </header>

    <main class="mx-auto mt-8 max-w-6xl px-5 sm:px-8">
      <RouterView />
    </main>
  </div>
</template>

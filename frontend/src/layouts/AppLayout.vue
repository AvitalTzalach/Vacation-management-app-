<!--
  AppLayout: frame of every signed-in page.
  A landscape hero banner holds the logo, the navigation (by role), the user's name and role,
  and the page title / subtitle (from the route meta). The page itself renders below.
-->
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter, type RouteLocationRaw } from "vue-router";
import heroImage from "@/assets/images/hero-mountains.jpg";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

interface NavItem {
  label: string;
  to: RouteLocationRaw;
}

// Navigation depends on the role: requesters see their requests, validators the dashboard.
// Team planning is shared by both roles.
const navItems = computed<NavItem[]>(() => [
  auth.user?.role === "Validator"
    ? { label: "Dashboard", to: { name: "dashboard" } }
    : { label: "My requests", to: { name: "my-requests" } },
  { label: "Team planning", to: { name: "team-planning" } },
]);

function signOut(): void {
  auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="min-h-screen pb-10">
    <header class="relative isolate overflow-hidden">
      <img
        :src="heroImage"
        alt=""
        class="absolute inset-0 -z-20 size-full object-cover object-[center_72%]"
      />
      <!-- The misty photo is very light: a soft dark gradient keeps the white text readable. -->
      <div class="absolute inset-0 -z-10 bg-gradient-to-r from-slate-900/55 via-slate-900/30 to-slate-900/10" />

      <div class="mx-auto max-w-6xl px-5 pt-4 pb-8 sm:px-8 sm:pb-11">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <RouterLink :to="{ name: 'home' }" class="font-display text-3xl leading-none text-white sm:text-4xl">Away</RouterLink>

          <nav class="flex flex-wrap items-center gap-1 text-sm text-white/90" aria-label="Main">
            <RouterLink
              v-for="item in navItems"
              :key="item.label"
              :to="item.to"
              class="rounded-full px-3 py-1.5 transition hover:bg-white/15"
              active-class="bg-white/25 text-white backdrop-blur-sm"
            >
              {{ item.label }}
            </RouterLink>
            <button type="button" class="rounded-full px-3 py-1.5 transition hover:bg-white/15" @click="signOut">
              Sign out
            </button>
          </nav>
        </div>

        <div class="mt-7 sm:mt-10">
          <p v-if="auth.user" class="text-xs font-medium text-white/85 sm:text-sm">
            {{ auth.user.name }} · {{ auth.user.role }}
          </p>
          <h1 class="font-display text-3xl leading-tight text-white sm:text-4xl">{{ route.meta.title }}</h1>
          <p v-if="route.meta.subtitle" class="text-sm text-white/90">{{ route.meta.subtitle }}</p>
        </div>
      </div>
    </header>

    <main class="mx-auto mt-6 max-w-6xl px-5 sm:px-8">
      <RouterView />
    </main>
  </div>
</template>

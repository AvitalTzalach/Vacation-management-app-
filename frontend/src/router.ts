/**
 * Vue Router: routes and navigation guards.
 *
 * Route meta drives the guards:
 * - requiresAuth: only for signed-in users (otherwise → /login?redirect=...);
 * - guestOnly:    only for signed-out users (the login page);
 * - roles:        allowed roles (otherwise → the user's own home page);
 * - title / subtitle: texts of the page header (AppLayout).
 * The guards are for UX only; the API enforces the same rules (401 / 403).
 */
import { createRouter, createWebHistory, type RouteLocationRaw } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";
import { useAuthStore } from "@/stores/auth";
import type { Role } from "@/types";

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    roles?: Role[];
    title?: string;
    subtitle?: string;
  }
}

// Landing page of each role after login.
export function homeRouteFor(role: Role): RouteLocationRaw {
  return role === "Validator" ? { name: "dashboard" } : { name: "my-requests" };
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { guestOnly: true },
    },
    {
      path: "/",
      component: AppLayout,
      meta: { requiresAuth: true },
      children: [
        {
          // "/" sends each user to their own home page.
          path: "",
          name: "home",
          redirect: () => {
            const auth = useAuthStore();
            return auth.user ? homeRouteFor(auth.user.role) : { name: "login" };
          },
        },
        {
          path: "my-requests",
          name: "my-requests",
          component: () => import("@/views/MyRequestsView.vue"),
          meta: {
            roles: ["Requester"],
            title: "Where to next?",
            subtitle: "Submit a request and follow its status.",
          },
        },
        {
          path: "dashboard",
          name: "dashboard",
          component: () => import("@/views/ValidatorDashboardView.vue"),
          meta: {
            roles: ["Validator"],
            title: "Review requests",
            subtitle: "Approve or reject your team's time off.",
          },
        },
        {
          path: "team-planning",
          name: "team-planning",
          component: () => import("@/views/TeamPlanningView.vue"),
          meta: {
            roles: ["Requester", "Validator"],
            title: "Team planning",
            subtitle: "Who's away, and when.",
          },
        },
      ],
    },
    // Unknown URLs go back to the home page.
    { path: "/:pathMatch(.*)*", redirect: { name: "home" } },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  // Not signed in → login page, remembering where the user wanted to go.
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return to.name === "home" ? { name: "login" } : { name: "login", query: { redirect: to.fullPath } };
  }

  if (!auth.user) return true;

  // Already signed in → no need to see the login page.
  if (to.meta.guestOnly) return homeRouteFor(auth.user.role);

  // Page reserved to another role → the user's own home page.
  if (to.meta.roles && !to.meta.roles.includes(auth.user.role)) return homeRouteFor(auth.user.role);

  return true;
});

export default router;

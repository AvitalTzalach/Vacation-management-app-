/**
 * Application entry point: fonts and styles, Pinia, the router, and the HTTP client wiring.
 */
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/500.css";
import "@fontsource/work-sans/600.css";
import "@fontsource/instrument-serif/400.css";
import "./style.css";

import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import { configureHttp } from "./api/http";
import router from "./router";
import { useAuthStore } from "./stores/auth";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

const auth = useAuthStore(pinia);

// Every API request reads the current token from the store. When the API answers 401
// (token expired or invalid), the user is signed out and sent to the login page,
// which then explains that the session expired.
configureHttp({
  getToken: () => auth.token,
  onUnauthorized: () => {
    if (!auth.isAuthenticated) return;
    auth.logout();
    const current = router.currentRoute.value;
    router.replace({ name: "login", query: { reason: "expired", redirect: current.fullPath } });
  },
});

app.mount("#app");

import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AuthProvider } from "./lib/auth";
import { PreferencesProvider } from "./lib/preferences";
import { AudioPlayerProvider } from "./lib/audioPlayer";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <PreferencesProvider>
      <AudioPlayerProvider>
        <RouterProvider router={router} />
      </AudioPlayerProvider>
    </PreferencesProvider>
  </AuthProvider>,
);

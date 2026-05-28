import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { Shell } from "./layout/Shell";
import { Placeholder } from "./pages/Placeholder";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/v2/players" replace />,
  },
  {
    path: "/v2",
    element: <Shell />,
    handle: { crumb: "OLManager" },
    children: [
      { index: true, element: <Navigate to="players" replace /> },
      {
        path: "live",
        handle: { crumb: "Live Matches" },
        element: <Placeholder title="Live Matches" />,
      },
      {
        path: "history",
        handle: { crumb: "Matches History" },
        element: <Placeholder title="Matches History" />,
      },
      {
        path: "insider",
        handle: { crumb: "Leagues Insider" },
        element: <Placeholder title="Leagues Insider" />,
      },
      {
        path: "players",
        handle: { crumb: "Players Database" },
        element: <Placeholder title="Players Database" />,
      },
      {
        path: "betting",
        handle: { crumb: "Betting" },
        element: <Placeholder title="Betting" />,
      },
    ],
  },
]);

export default function AppV2() {
  return (
    <div className="dark">
      <RouterProvider router={router} />
    </div>
  );
}

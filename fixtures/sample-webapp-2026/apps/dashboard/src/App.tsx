import type { DashboardFilter } from "../../../packages/contracts/src/index.ts";
import { DeploymentRail } from "./components/DeploymentRail.tsx";
import { IncidentFeed } from "./components/IncidentFeed.tsx";
import { RecommendationRail } from "./components/RecommendationRail.tsx";
import { ServicePanel } from "./components/ServicePanel.tsx";
import { SummaryCards } from "./components/SummaryCards.tsx";
import { useDashboardController } from "./hooks/use-dashboard-controller.ts";

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function App(input: {
  initialSeverity: DashboardFilter;
  initialFocusServiceId: string | null;
}) {
  const controller = useDashboardController(input);

  if (!controller.snapshot && !controller.error) {
    return (
      <main className="shell shell-loading">
        <div className="loading-card">Loading the review dashboard…</div>
      </main>
    );
  }

  if (controller.error || !controller.snapshot) {
    return (
      <main className="shell shell-loading">
        <div className="loading-card loading-error">
          <strong>Dashboard failed to load.</strong>
          <p>{controller.error ?? "Unknown error"}</p>
        </div>
      </main>
    );
  }

  const snapshot = controller.snapshot;

  return (
    <main className="shell">
      <div className="ambient ambient-amber" aria-hidden="true" />
      <div className="ambient ambient-cyan" aria-hidden="true" />

      <header className="hero-card">
        <div>
          <p className="hero-eyebrow">flaker × vrt reference</p>
          <h1>Control Atlas</h1>
          <p className="hero-copy">
            A deliberately compact operator dashboard backed by a Hono API, wired for
            Playwright sampling, visual review, and scheduled code improvement.
          </p>
        </div>
        <div className="hero-sidecar">
          <span>Snapshot {formatGeneratedAt(snapshot.generatedAt)} UTC</span>
          <button type="button" onClick={() => controller.refresh()} disabled={controller.isPending}>
            {controller.isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <SummaryCards metrics={snapshot.summary} />

      <div className="board-grid">
        <section className="panel panel-wide">
          <div className="panel-header">
            <div>
              <p className="kicker">Release shape</p>
              <h2>Deployment flow over the last week</h2>
            </div>
          </div>
          <DeploymentRail points={snapshot.deploymentSeries} />
        </section>

        <IncidentFeed
          incidents={snapshot.incidents}
          activeFilter={controller.severity}
          onFilterChange={controller.selectSeverity}
          onFocusService={controller.focusService}
        />

        <RecommendationRail recommendations={snapshot.recommendations} />

        <ServicePanel
          services={snapshot.services}
          selectedServiceId={controller.focusServiceId}
          detail={controller.serviceDetail}
          onSelectService={controller.focusService}
          onClose={() => controller.focusService(null)}
        />
      </div>
    </main>
  );
}

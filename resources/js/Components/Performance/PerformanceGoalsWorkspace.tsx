import type { EvaluationPeriod } from '@/data/evaluatorAssignments';
import type { GoalTemplate } from '@/data/performancePlanning';
import {
  LibraryBig,
  ShieldCheck,
  Target,
  UserRound,
} from 'lucide-react';

type Props = {
  goalTemplates: GoalTemplate[];
  activeCycle?: EvaluationPeriod;
  embedded?: boolean;
};

function totalWeight(items: GoalTemplate['items']) {
  return items.reduce((sum, item) => sum + Number(item.weight || 0), 0);
}

function scopeLabel(template: GoalTemplate) {
  const departments = template.departmentScopes.length
    ? template.departmentScopes.join(', ')
    : 'All departments';
  const positions = template.positionScopes.length
    ? template.positionScopes.join(', ')
    : 'All applicable positions';

  return { departments, positions };
}

export default function PerformanceGoalsWorkspace({
  goalTemplates,
  activeCycle,
  embedded = false,
}: Props) {
  const cycleId = activeCycle?.id ?? '';

  function templateMatchesCycle(template: GoalTemplate) {
    return !cycleId || template.cycleIds.length === 0 || template.cycleIds.includes(cycleId);
  }

  const cycleTemplates = goalTemplates.filter(templateMatchesCycle);
  const activeTemplates = cycleTemplates.filter((template) => template.active);
  const metricCount = cycleTemplates.reduce((sum, template) => sum + template.items.length, 0);
  const compliantTemplates = cycleTemplates.filter(
    (template) => totalWeight(template.items) === 100,
  ).length;
  const personTypes = new Set(
    cycleTemplates.flatMap((template) => template.applicablePersonTypes),
  );

  const summaryCards = [
    {
      label: 'Governed Goal Plans',
      value: cycleTemplates.length,
      note: activeCycle
        ? `Official frameworks applicable to ${activeCycle.cycleName}`
        : 'Official performance frameworks available to Performance',
      icon: LibraryBig,
    },
    {
      label: 'Configured Metrics',
      value: metricCount,
      note: 'KRA, KPI, and Goal definitions across the selected frameworks',
      icon: Target,
    },
    {
      label: 'Weight Compliance',
      value: `${compliantTemplates}/${cycleTemplates.length || 0}`,
      note: 'Frameworks whose configured weights total exactly 100%',
      icon: ShieldCheck,
    },
    {
      label: 'Person Types',
      value: personTypes.size,
      note: 'Canonical workforce person types covered by these frameworks',
      icon: UserRound,
    },
  ];

  return (
    <div className="space-y-4">
      {!embedded && (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                <p className="mt-1.5 text-xl font-extrabold text-slate-950">{card.value}</p>
              </div>
              <span className="rounded-lg bg-amber-50 p-2 text-amber-700">
                <card.icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{card.note}</p>
          </div>
        ))}
      </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
          <div className="max-w-4xl">
            <h2 className="text-sm font-bold text-slate-900">Goal &amp; KPI Frameworks</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Company-authorized performance frameworks for the selected cycle. Data B determines applicability, while person-level progress, evaluation, calibration, and final results remain in Reviews.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            <ShieldCheck className="h-3.5 w-3.5" /> Source-governed
          </span>
        </div>

        {cycleTemplates.length > 0 ? (
          <div className="grid auto-rows-fr gap-4 p-4 xl:grid-cols-2">
            {cycleTemplates.map((template) => {
              const scope = scopeLabel(template);
              const configuredWeight = totalWeight(template.items);

              return (
                <article
                  key={template.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50"
                >
                  <div className="flex-none border-b border-slate-200 bg-white px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-950">{template.name}</h3>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {template.description || 'No framework description recorded.'}
                        </p>
                      </div>
                      {!template.active && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                          Historical
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Person Type</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-700">
                          {template.applicablePersonTypes.join(' / ') || 'Not specified'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Department Scope</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-700">{scope.departments}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Position Scope</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-700">{scope.positions}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Framework Weight</p>
                        <p className={`mt-1 text-[11px] font-extrabold ${configuredWeight === 100 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {configuredWeight}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Performance Measures
                      </p>
                      <span className="text-[10px] font-semibold text-slate-500">
                        {template.items.length} metric{template.items.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="grid flex-1 auto-rows-fr gap-2">
                      {template.items.map((item) => (
                        <div
                          key={item.id}
                          className="min-h-[78px] rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_76px] items-stretch gap-3">
                            <div className="min-w-0 self-center">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                                  {item.metricType}
                                </span>
                                <p className="text-xs font-bold text-slate-800">{item.title}</p>
                              </div>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                                Target: {item.target}
                                {item.unit ? ` · Unit: ${item.unit}` : ''}
                              </p>
                              {item.description && (
                                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{item.description}</p>
                              )}
                            </div>
                            <div className="flex w-[76px] min-w-[76px] flex-col items-center justify-center self-stretch rounded-lg bg-slate-50 px-2 py-2 text-center">
                              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Weight</p>
                              <p className="mt-0.5 text-xs font-extrabold tabular-nums text-slate-900">{item.weight}%</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-12 text-center">
            <LibraryBig className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No goal framework is available for this cycle.</p>
            <p className="mt-1 text-xs text-slate-500">
              The selected cycle does not currently have a company-authorized Goal/KPI framework in scope.
            </p>
          </div>
        )}
      </section>

      {activeTemplates.length !== cycleTemplates.length && cycleTemplates.length > 0 && (
        <p className="px-1 text-[10px] leading-4 text-slate-400">
          Historical frameworks remain visible only when they are part of the selected cycle record.
        </p>
      )}
    </div>
  );
}

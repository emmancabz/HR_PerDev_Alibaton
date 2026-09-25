import { buildCompetencyProfiles } from '@/data/competencyCalculations';
import { learningClient } from '@/data/learningClient';
import { trainingClient } from '@/data/trainingClient';
import { usePage } from '@inertiajs/react';
import axios from 'axios';
import { ArrowUp, LoaderCircle, X } from 'lucide-react';
import { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type AevynDockSide = 'left' | 'right';

type AevynShellProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    dockSide: AevynDockSide;
    onDockSideChange: (side: AevynDockSide) => void;
};

type AevynMessage = {
    id: string;
    role: 'assistant' | 'user';
    content: string;
};

type AevynModuleWhisper = {
    module: 'Users' | 'Performance';
    message: string;
    tone?: 'info' | 'warning';
};

type AevynPublishedScreenContext = {
    source: string;
    context: Record<string, unknown> | null;
};

type AevynScreenContext = {
    module: string | null;
    route: string;
    hash: string | null;
    pageTitle: string;
    heading: string | null;
    activeNavigation: string[];
    openSurface: {
        type: string;
        title: string | null;
        description: string | null;
        visibleText: string | null;
    } | null;
    filters: Array<{ label: string; value: string }>;
    published: Record<string, Record<string, unknown>>;
};

type DragState = {
    pointerId: number;
    startX: number;
    startLeft: number;
    width: number;
    moved: boolean;
};

const DEFAULT_QUICK_PROMPTS = [
    'Summarize this page',
    'Explain what needs my attention',
    'What should I do next?',
    'Explain my current records',
];

function decodedHash(value: string | null): string {
    if (!value) return '';
    try {
        return decodeURIComponent(value.replace(/^#/, '').replace(/\+/g, ' '));
    } catch {
        return value.replace(/^#/, '');
    }
}

function quickPromptsForContext(context: AevynScreenContext | null): string[] {
    if (!context) return DEFAULT_QUICK_PROMPTS;

    const route = context.route.toLowerCase();
    const workspace = decodedHash(context.hash).toLowerCase();
    const course = context.published?.['learner-course-player'];
    const courseView = String(course?.view ?? '').toLowerCase();

    if (course && courseView === 'lesson') {
        return [
            'Explain this lesson',
            'Summarize this module',
            'What should I do next?',
            'What course requirements are still pending?',
        ];
    }

    if (course && (courseView === 'module' || courseView === 'quiz')) {
        return [
            'Summarize this module',
            'What is still required in this module?',
            'What should I do next?',
            'Explain my progress in this course',
        ];
    }

    if (course) {
        return [
            'Summarize this course',
            'What should I continue next?',
            'What course requirements are still pending?',
            'Explain my progress in this course',
        ];
    }

    if (route.includes('/user/dashboard')) {
        return [
            'What should I focus on today?',
            'Summarize my learning status',
            'Do I have upcoming training?',
            'What development items need attention?',
        ];
    }

    if (route.includes('/user/learning')) {
        if (workspace.includes('assigned')) return ['What learning is assigned to me?', 'Which assignment is due first?', 'What should I start next?', 'Explain my required learning'];
        if (workspace.includes('recommended')) return ['Why were these courses recommended?', 'Which recommendation should I review first?', 'How do these relate to my development?', 'Show my active learning'];
        if (workspace.includes('progress')) return ['Summarize my learning progress', 'What is still unfinished?', 'Which course should I resume?', 'Show my completed learning'];
        if (workspace.includes('catalog')) return ['Explain the courses available to me', 'Which courses can I self-enroll in?', 'Which catalog courses am I already enrolled in?', 'How does self-enrollment work?'];
        return ['Which course should I continue?', 'What learning is still in progress?', 'What should I do next?', 'Show my completed learning'];
    }

    if (route.includes('/user/assessments')) {
        return ['What assessments need my attention?', 'Explain my available assessments', 'Summarize my assessment results', 'What should I complete next?'];
    }

    if (route.includes('/user/training')) {
        if (workspace.includes('trainer evaluation')) return ['Do I have trainer evaluations to complete?', 'Which trainer evaluations are still pending?', 'Explain the trainer evaluation criteria', 'Which evaluations are already done?'];
        if (workspace.includes('attendance')) return ['Summarize my training attendance', 'Do I have pending attendance records?', 'Which training sessions have attendance recorded?', 'When do trainer evaluations open?'];
        if (workspace.includes('request')) return ['Summarize my training requests', 'Do I have pending training requests?', 'What happens after a training request?', 'Show my training schedule'];
        return ['What training is coming up?', 'When do trainer evaluations open?', 'Summarize my training schedule', 'Where is my next training?'];
    }

    if (route.includes('/user/development') || route.includes('/user/skills-wallet')) {
        if (workspace.includes('skill gap')) return ['Explain my current skill gaps', 'Which gap should I develop first?', 'What learning supports my gaps?', 'How are competency gaps validated?'];
        if (workspace.includes('learning history')) return ['Summarize my learning history', 'What did I complete this quarter?', 'Which completed learning has a certificate?', 'How can this support my quarterly evaluation?'];
        return ['Summarize my competency progress', 'Which competencies need attention?', 'Explain my validated competency levels', 'Show my current skill gaps'];
    }

    if (route.includes('/user/certificates')) {
        if (workspace.includes('achievement')) return ['Summarize my achievements', 'What achievements have I earned?', 'Explain my latest achievement', 'Show my issued certificates'];
        return ['Show my issued certificates', 'Which completed learning has a certificate?', 'Explain my certificate records', 'Show my learning history'];
    }

    if (route.includes('/user/profile')) {
        return ['Summarize this profile page', 'Explain my learning record', 'What profile information is available here?', 'Show my notifications'];
    }

    if (route.includes('/user/notifications')) {
        return ['Summarize my notifications', 'Which notifications need attention?', 'Explain my latest notification', 'What should I check next?'];
    }

    return DEFAULT_QUICK_PROMPTS;
}

const AEVYN_LOGO = '/branding/aevyn.png';

export default function AevynShell({
    open,
    onOpenChange,
    dockSide,
    onDockSideChange,
}: AevynShellProps) {
    const page = usePage();
    const authUser = (page.props as any)?.auth?.user ?? null;
    const isLearnerPersona = String(authUser?.role ?? '') === 'user';
    const pageUrl = String((page as any)?.url ?? '');
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [morphing, setMorphing] = useState(false);
    const [performanceExpanded, setPerformanceExpanded] = useState(false);
    const [normalPanelTop, setNormalPanelTop] = useState(180);
    const [expandedPanelTop, setExpandedPanelTop] = useState(96);
    const [workspaceLeft, setWorkspaceLeft] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [dragOffsetX, setDragOffsetX] = useState(0);
    const [moduleWhisper, setModuleWhisper] = useState<AevynModuleWhisper | null>(null);
    const [whisperVisible, setWhisperVisible] = useState(false);
    const [screenSnapshot, setScreenSnapshot] = useState<AevynScreenContext | null>(null);
    const [connectedContextLoading, setConnectedContextLoading] = useState(false);
    const [messages, setMessages] = useState<AevynMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content:
                "Hi, I'm Aevyn. I can help explain your current learning, training, development, performance, and other records you are authorized to view.",
        },
    ]);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const morphTimerRef = useRef<number | null>(null);
    const whisperTimerRef = useRef<number | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const suppressOrbClickRef = useRef(false);
    const publishedScreenContextRef = useRef<
        Record<string, Record<string, unknown>>
    >({});
    const connectedContextRef = useRef<Record<string, unknown>>({});
    const connectedContextLoadedAtRef = useRef(0);

    const hasConversation = messages.length > 1;
    const quickPrompts = useMemo(
        () => quickPromptsForContext(screenSnapshot),
        [screenSnapshot],
    );
    const canSend = useMemo(
        () => input.trim().length > 0 && !loading,
        [input, loading],
    );

    useEffect(() => {
        const updateGeometry = () => {
            const main =
                document.querySelector<HTMLElement>('.app-main');

            const appHeader =
                document.querySelector<HTMLElement>(
                    '[data-pd-app-header="true"]',
                );

            if (main) {
                const rect = main.getBoundingClientRect();

                setNormalPanelTop(
                    Math.max(
                        16,
                        Math.round(rect.top) + 12,
                    ),
                );

                setWorkspaceLeft(
                    Math.max(
                        0,
                        Math.round(rect.left),
                    ),
                );
            }

            /*
             * When a Performance Analytics surface is expanded,
             * align Aevyn with the actual expanded dialog surface,
             * not with the normal module-content position.
             */
            const expandedDialog =
                document.querySelector<HTMLElement>(
                    '.performance-expanded-chart-dialog',
                );

            if (performanceExpanded && expandedDialog) {
                const dialogRect =
                    expandedDialog.getBoundingClientRect();

                setExpandedPanelTop(
                    Math.max(
                        16,
                        Math.round(dialogRect.top),
                    ),
                );
            } else if (appHeader) {
                const headerRect =
                    appHeader.getBoundingClientRect();

                setExpandedPanelTop(
                    Math.max(
                        16,
                        Math.round(headerRect.bottom) + 12,
                    ),
                );
            }
        };

        updateGeometry();
        const frame = window.requestAnimationFrame(updateGeometry);
        window.addEventListener('resize', updateGeometry);

        const main = document.querySelector<HTMLElement>('.app-main');
        const observer =
            typeof ResizeObserver !== 'undefined' && main
                ? new ResizeObserver(updateGeometry)
                : null;

        observer?.observe(main as HTMLElement);

        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener('resize', updateGeometry);
            observer?.disconnect();
        };
    }, [open, performanceExpanded]);

    useEffect(() => {
        const handlePerformanceExpanded = (event: Event) => {
            const detail = (
                event as CustomEvent<{ open?: boolean }>
            ).detail;

            setPerformanceExpanded(detail?.open === true);
        };

        window.addEventListener(
            'aevyn:performance-expanded',
            handlePerformanceExpanded,
        );

        return () => {
            window.removeEventListener(
                'aevyn:performance-expanded',
                handlePerformanceExpanded,
            );
        };
    }, []);

    useEffect(() => {
        const handlePublishedScreenContext = (event: Event) => {
            const detail = (
                event as CustomEvent<AevynPublishedScreenContext>
            ).detail;

            if (!detail?.source) return;

            if (detail.context === null) {
                delete publishedScreenContextRef.current[detail.source];
                window.requestAnimationFrame(() => {
                    setScreenSnapshot(collectScreenContext());
                });
                return;
            }

            publishedScreenContextRef.current[detail.source] =
                detail.context;
            window.requestAnimationFrame(() => {
                setScreenSnapshot(collectScreenContext());
            });
        };

        window.addEventListener(
            'aevyn:screen-context',
            handlePublishedScreenContext,
        );

        return () => {
            window.removeEventListener(
                'aevyn:screen-context',
                handlePublishedScreenContext,
            );
        };
    }, []);

    useEffect(() => {
        const handleModuleWhisper = (event: Event) => {
            const detail = (
                event as CustomEvent<AevynModuleWhisper>
            ).detail;

            if (!detail?.message || open) return;

            if (whisperTimerRef.current) {
                window.clearTimeout(whisperTimerRef.current);
            }

            setModuleWhisper(detail);
            setWhisperVisible(true);

            whisperTimerRef.current = window.setTimeout(() => {
                setWhisperVisible(false);
            }, 3000);
        };

        window.addEventListener(
            'aevyn:module-whisper',
            handleModuleWhisper,
        );

        return () => {
            window.removeEventListener(
                'aevyn:module-whisper',
                handleModuleWhisper,
            );

            if (whisperTimerRef.current) {
                window.clearTimeout(whisperTimerRef.current);
            }
        };
    }, [open]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
        });
    }, [messages, loading]);

    useEffect(() => {
        if (!open) return;

        const timer = window.setTimeout(() => {
            textareaRef.current?.focus();
        }, 180);

        return () => window.clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        return () => {
            if (morphTimerRef.current) {
                window.clearTimeout(morphTimerRef.current);
            }
        };
    }, []);

    function isVisible(element: Element | null): element is HTMLElement {
        if (!(element instanceof HTMLElement)) return false;

        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number(style.opacity || '1') > 0 &&
            rect.width > 0 &&
            rect.height > 0
        );
    }

    function cleanText(value: string | null | undefined): string | null {
        if (!value) return null;

        const cleaned = value.replace(/\s+/g, ' ').trim();
        return cleaned.length > 0 ? cleaned : null;
    }

    function inferModule(): string | null {
        const path = window.location.pathname.toLowerCase();

        if (path.includes('performance')) return 'Performance';
        if (path.includes('competency')) return 'Competency';
        if (path.includes('learning')) return 'Learning';
        if (path.includes('training')) return 'Training';
        if (path.includes('succession')) return 'Succession';
        if (path.includes('recognition')) return 'Recognition';
        if (path.includes('users') || path.includes('user-management')) {
            return 'Users';
        }
        if (path.includes('reports')) return 'Reports';

        return null;
    }

    function collectScreenContext(): AevynScreenContext {
        const surfaceCandidates = Array.from(
            document.querySelectorAll<HTMLElement>(
                '[role="dialog"][aria-modal="true"], .performance-expanded-chart-dialog, .performance-review-drawer',
            ),
        ).filter(isVisible);

        const surface = surfaceCandidates.at(-1) ?? null;
        const surfaceTitle = surface
            ? cleanText(
                  surface.getAttribute('data-aevyn-context-surface') ??
                      surface.getAttribute('aria-label') ??
                      surface.querySelector<HTMLElement>('h1,h2,h3')
                          ?.innerText,
              )
            : null;
        const surfaceDescription = surface
            ? cleanText(
                  surface.getAttribute('data-aevyn-context-description') ??
                      surface.querySelector<HTMLElement>('h1,h2,h3')
                          ?.nextElementSibling?.textContent,
              )
            : null;
        const visibleSurfaceText = surface
            ? cleanText(surface.innerText)?.slice(0, 2800) ?? null
            : null;

        const mainHeading = Array.from(
            document.querySelectorAll<HTMLElement>(
                '.app-main h1, .app-main h2, header h1, header h2',
            ),
        ).find(isVisible);

        const activeNavigation = Array.from(
            document.querySelectorAll<HTMLElement>('aside a, aside button'),
        )
            .filter((element) => {
                if (!isVisible(element)) return false;

                return (
                    element.getAttribute('aria-current') === 'page' ||
                    element.className.includes('bg-amber') ||
                    element.className.includes('bg-[#')
                );
            })
            .map((element) => cleanText(element.innerText))
            .filter((value): value is string => Boolean(value))
            .slice(0, 6);

        const filterRoot = surface ?? document;
        const filters = Array.from(
            filterRoot.querySelectorAll<HTMLSelectElement>('select'),
        )
            .filter((select) => isVisible(select))
            .map((select) => ({
                label:
                    select.getAttribute('aria-label') ??
                    select.name ??
                    'Filter',
                value:
                    select.selectedOptions[0]?.textContent?.trim() ??
                    select.value,
            }))
            .filter((item) => item.value)
            .slice(0, 12);

        return {
            module: inferModule(),
            route: window.location.pathname + window.location.search,
            hash: window.location.hash || null,
            pageTitle: document.title,
            heading: cleanText(mainHeading?.innerText),
            activeNavigation,
            openSurface: surface
                ? {
                      type: surface.matches('.performance-expanded-chart-dialog')
                          ? 'expanded_chart'
                          : surface.matches('.performance-review-drawer')
                            ? 'drawer'
                            : 'dialog',
                      title: surfaceTitle,
                      description: surfaceDescription,
                      visibleText: visibleSurfaceText,
                  }
                : null,
            filters,
            published: { ...publishedScreenContextRef.current },
        };
    }

    function compactLearningContext(state: any): Record<string, unknown> {
        const assignments = Array.isArray(state?.assignments) ? state.assignments : [];
        const completions = Array.isArray(state?.completions) ? state.completions : [];
        const catalog = Array.isArray(state?.catalog) ? state.catalog : [];
        const requests = Array.isArray(state?.requests) ? state.requests : [];

        return {
            activeAssignments: assignments
                .filter((row: any) => !['Completed', 'Cancelled', 'Expired'].includes(String(row?.status ?? '')))
                .slice(0, 20)
                .map((row: any) => ({
                    id: row?.id,
                    title: row?.title ?? row?.course_title,
                    status: row?.display_status ?? row?.status,
                    progressPercent: Number(row?.progress_percent ?? 0),
                    dueAt: row?.due_at ?? null,
                    mandatory: Boolean(row?.is_mandatory),
                    versionId: row?.course_version_id ?? null,
                })),
            completedLearning: completions.slice(0, 20).map((row: any) => ({
                id: row?.id,
                title: row?.title ?? row?.course_title,
                completedAt: row?.completed_at ?? null,
                versionNumber: row?.version_number ?? null,
                certificateNumber: row?.certificate_number ?? null,
                certificateStatus: row?.certificate_status ?? (row?.certificate_id ? 'Issued' : 'Not issued'),
            })),
            catalog: catalog.slice(0, 18).map((row: any) => ({
                id: row?.id,
                code: row?.code,
                title: row?.title,
                category: row?.category,
                publishedVersionId: row?.publishedVersionId ?? row?.published_version_id ?? null,
            })),
            recommendations: requests.slice(0, 12).map((row: any) => ({
                id: row?.id,
                title: row?.title,
                status: row?.status,
                competencyName: row?.competency_name ?? row?.competencyName ?? null,
            })),
        };
    }

    function compactTrainingContext(state: any): Record<string, unknown> {
        const programs = Array.isArray(state?.programs) ? state.programs : [];
        const enrollments = Array.isArray(state?.enrollments) ? state.enrollments : [];
        const programTitle = new Map(
            programs.map((row: any) => [String(row?.id ?? ''), row?.title ?? row?.name ?? row?.id]),
        );

        const trainerEvaluationTasks = Array.isArray(state?.trainerEvaluationTasks) ? state.trainerEvaluationTasks : [];

        return {
            enrollments: enrollments.slice(0, 20).map((row: any) => ({
                id: row?.id,
                programId: row?.programId ?? row?.program_id,
                program: programTitle.get(String(row?.programId ?? row?.program_id ?? '')) ?? row?.programId ?? row?.program_id,
                status: row?.status,
                source: row?.source ?? null,
                sessions: (Array.isArray(row?.sessions) ? row.sessions : []).slice(0, 8).map((session: any) => ({
                    id: session?.id,
                    label: session?.label,
                    startsAt: session?.startsAt ?? session?.starts_at,
                    endsAt: session?.endsAt ?? session?.ends_at,
                    venue: session?.venue,
                    status: session?.sessionStatus ?? session?.status,
                    attendance: session?.attendance?.trainingStatus ?? session?.attendance?.status ?? null,
                })),
                completion: row?.completion
                    ? {
                          status: row.completion?.status,
                          completedAt: row.completion?.completedAt ?? row.completion?.completed_at ?? null,
                          certificateStatus: row.completion?.certificate?.status ?? null,
                      }
                    : null,
            })),
            trainerEvaluationQuarter: state?.trainerEvaluationQuarter ?? null,
            trainerEvaluations: trainerEvaluationTasks.slice(0, 16).map((row: any) => ({
                quarter: row?.quarterLabel,
                trainer: row?.trainerName,
                status: row?.status,
                sessionCount: row?.sessionCount,
                trainingTitles: row?.trainingTitles,
            })),
        };
    }

    function compactCompetencyContext(payload: any): Record<string, unknown> | null {
        const state = payload?.state ?? payload;
        if (!state || !authUser?.personnel_key) return null;

        try {
            const profiles = buildCompetencyProfiles(state as any);
            const profile = profiles.find(
                (row: any) => String(row?.person?.id ?? '') === String(authUser.personnel_key),
            );
            if (!profile) return null;

            const requirements = Array.isArray(profile.requirements) ? profile.requirements : [];
            return {
                profile: profile.profile
                    ? {
                          id: profile.profile?.id,
                          name: profile.profile?.name,
                          position: profile.profile?.position,
                          department: profile.profile?.department,
                      }
                    : null,
                requirements: requirements.slice(0, 30).map((detail: any) => ({
                    competency: detail?.competency?.name ?? detail?.requirement?.competencyId,
                    category: detail?.competency?.category ?? null,
                    currentLevel: detail?.currentLevel ?? null,
                    requiredLevel: detail?.requiredLevel ?? detail?.requirement?.requiredLevel ?? null,
                    result: detail?.result ?? null,
                    lastAssessed: detail?.lastAssessed ?? null,
                })),
                gaps: requirements
                    .filter((detail: any) => ['Below Requirement', 'Not Assessed'].includes(String(detail?.result ?? '')))
                    .slice(0, 20)
                    .map((detail: any) => ({
                        competency: detail?.competency?.name ?? detail?.requirement?.competencyId,
                        currentLevel: detail?.currentLevel ?? null,
                        requiredLevel: detail?.requiredLevel ?? detail?.requirement?.requiredLevel ?? null,
                        result: detail?.result,
                    })),
            };
        } catch {
            return null;
        }
    }

    async function refreshConnectedContext(force = false): Promise<Record<string, unknown>> {
        if (!isLearnerPersona) return {};

        const age = Date.now() - connectedContextLoadedAtRef.current;
        if (!force && age < 30_000 && Object.keys(connectedContextRef.current).length > 0) {
            return connectedContextRef.current;
        }

        setConnectedContextLoading(true);

        const [learningResult, trainingResult, competencyResult, notificationsResult] = await Promise.allSettled([
            learningClient.state(),
            trainingClient.state(),
            axios.get('/competency/api/state'),
            axios.get('/api/header-notifications', { headers: { Accept: 'application/json' } }),
        ]);

        const next: Record<string, unknown> = {};

        if (learningResult.status === 'fulfilled') {
            next.learning = compactLearningContext(learningResult.value);
        }

        if (trainingResult.status === 'fulfilled') {
            next.training = compactTrainingContext(trainingResult.value);
        }

        if (competencyResult.status === 'fulfilled') {
            const development = compactCompetencyContext(
                competencyResult.value?.data?.data ?? competencyResult.value?.data,
            );
            if (development) next.development = development;
        }

        if (notificationsResult.status === 'fulfilled') {
            const value = notificationsResult.value?.data ?? {};
            next.notifications = {
                unreadCount: Number(value?.unreadCount ?? 0),
                activeCount: Number(value?.activeCount ?? 0),
                items: (Array.isArray(value?.data) ? value.data : []).slice(0, 12).map((row: any) => ({
                    category: row?.category,
                    title: row?.title,
                    description: row?.description,
                    meta: row?.meta,
                    isRead: Boolean(row?.isRead),
                })),
            };
        }

        connectedContextRef.current = next;
        connectedContextLoadedAtRef.current = Date.now();
        setConnectedContextLoading(false);
        return next;
    }

    useEffect(() => {
        const sync = () => {
            window.requestAnimationFrame(() => {
                setScreenSnapshot(collectScreenContext());
            });
        };

        sync();
        window.addEventListener('hashchange', sync);
        window.addEventListener('popstate', sync);

        return () => {
            window.removeEventListener('hashchange', sync);
            window.removeEventListener('popstate', sync);
        };
    }, [pageUrl]);

    useEffect(() => {
        if (!open || !isLearnerPersona) return;
        void refreshConnectedContext(false);
    }, [open, pageUrl, isLearnerPersona]);

    function beginHorizontalDrag(
        event: ReactPointerEvent<HTMLElement>,
    ) {
        if (event.button !== 0) return;

        const section = event.currentTarget.closest('section');
        if (!(section instanceof HTMLElement)) return;

        const rect = section.getBoundingClientRect();

        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startLeft: rect.left,
            width: rect.width,
            moved: false,
        };

        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragging(true);
    }

    function leftDockTarget(): number {
        /*
         * On normal pages, an open Aevyn panel stays beside the
         * application sidebar. During expanded Performance surfaces
         * (where the page behind is already dimmed/blurred), Aevyn may
         * use the full viewport and sit over the sidebar. The closed
         * orb may also live at the true left edge.
         */
        if (open && !performanceExpanded) {
            return Math.max(16, workspaceLeft + 16);
        }

        return 16;
    }

    function moveHorizontalDrag(
        event: ReactPointerEvent<HTMLElement>,
    ) {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const rawOffset = event.clientX - drag.startX;
        const minLeft =
            open && !performanceExpanded
                ? Math.max(16, workspaceLeft + 16)
                : 16;
        const maxLeft = Math.max(
            minLeft,
            window.innerWidth - drag.width - 16,
        );
        const nextLeft = Math.min(
            maxLeft,
            Math.max(minLeft, drag.startLeft + rawOffset),
        );
        const offset = nextLeft - drag.startLeft;

        if (Math.abs(rawOffset) >= 6) {
            drag.moved = true;
        }

        setDragOffsetX(offset);
    }

    function endHorizontalDrag(
        event: ReactPointerEvent<HTMLElement>,
    ) {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        if (!drag.moved) {
            dragStateRef.current = null;
            setDragOffsetX(0);
            setDragging(false);
            return;
        }

        const finalLeft = drag.startLeft + dragOffsetX;
        const finalCenter = finalLeft + drag.width / 2;
        const viewportCenter = window.innerWidth / 2;
        const nextSide: AevynDockSide =
            finalCenter < viewportCenter ? 'left' : 'right';
        const targetLeft =
            nextSide === 'left'
                ? leftDockTarget()
                : window.innerWidth - drag.width - 16;

        /*
         * Preserve the exact on-screen position for one frame after the
         * dock side changes, then animate the remaining transform to 0.
         * This removes the old left/right jump and gives the release a
         * smooth magnetic snap.
         */
        suppressOrbClickRef.current = true;
        setDragging(false);
        onDockSideChange(nextSide);
        setDragOffsetX(finalLeft - targetLeft);
        dragStateRef.current = null;

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                setDragOffsetX(0);
            });
        });
    }

    function morphTo(nextOpen: boolean) {
        if (morphing) return;

        if (nextOpen) {
            setWhisperVisible(false);

            if (whisperTimerRef.current) {
                window.clearTimeout(whisperTimerRef.current);
            }
        }

        setMorphing(true);
        onOpenChange(nextOpen);

        if (morphTimerRef.current) {
            window.clearTimeout(morphTimerRef.current);
        }

        morphTimerRef.current = window.setTimeout(() => {
            setMorphing(false);
        }, 220);
    }

    function applyQuickPrompt(prompt: string) {
        setInput(prompt);

        window.setTimeout(() => {
            textareaRef.current?.focus();
        }, 40);
    }

    async function sendMessage(messageText?: string) {
        const content = (messageText ?? input).trim();

        if (!content || loading) return;

        const userMessage: AevynMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content,
        };

        setMessages((previous) => [...previous, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const connectedContext = isLearnerPersona
                ? await refreshConnectedContext(false)
                : connectedContextRef.current;
            const screenContext = collectScreenContext();
            setScreenSnapshot(screenContext);

            const response = await axios.post('/aevyn/chat', {
                message: content,
                screenContext,
                connectedContext,
            });

            const reply = String(
                response?.data?.reply ??
                    'I could not generate a response right now.',
            ).trim();

            setMessages((previous) => [
                ...previous,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content:
                        reply ||
                        'I could not generate a response right now.',
                },
            ]);
        } catch {
            setMessages((previous) => [
                ...previous,
                {
                    id: `assistant-error-${Date.now()}`,
                    role: 'assistant',
                    content:
                        'Aevyn is temporarily unavailable. Please try again in a moment.',
                },
            ]);
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void sendMessage();
        }
    }

    /*
     * Normal mode begins below the module workspace.
     *
     * Expanded Performance surfaces let Aevyn grow upward,
     * but never above the main application header.
     */
    const activePanelTop =
        performanceExpanded
            ? expandedPanelTop
            : normalPanelTop;

    const openHeight =
        `calc(100dvh - ${activePanelTop}px - 16px)`;

    return (
        <>
            <style>{`
                @keyframes aevyn-content-in {
                    from {
                        opacity: 0;
                        transform: translateY(5px) scale(.992);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes aevyn-whisper-in {
                    from {
                        opacity: 0;
                        transform: translateX(10px) scale(.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0) scale(1);
                    }
                }

                @keyframes aevyn-orb-idle {
                    0%, 100% {
                        transform: translateY(0) scale(1);
                    }
                    50% {
                        transform: translateY(-2px) scale(1.018);
                    }
                }

                .aevyn-chat-content {
                    animation: aevyn-content-in 170ms 45ms cubic-bezier(.22,1,.36,1) both;
                }

                .aevyn-whisper-content {
                    animation: aevyn-whisper-in 180ms cubic-bezier(.22,1,.36,1) both;
                }

                .aevyn-orb-idle {
                    animation: aevyn-orb-idle 3.4s ease-in-out infinite;
                }

                @media (prefers-reduced-motion: reduce) {
                    .aevyn-chat-content,
                    .aevyn-whisper-content,
                    .aevyn-orb-idle {
                        animation: none !important;
                    }
                }
            `}</style>

            {typeof document !== 'undefined' &&
                createPortal(
                    <section
                        aria-label="Aevyn AI assistant"
                        className={[
                            'fixed bottom-4 z-[2147483000] isolate',
                            dockSide === 'left'
                                ? 'origin-bottom-left'
                                : 'origin-bottom-right',
                            dragging
                                ? 'transition-none'
                                : 'transition-[width,height,left,right,border-radius,background-color,border-color,box-shadow,transform] duration-[260ms]',
                            'ease-[cubic-bezier(.16,1,.3,1)]',
                            open
                                ? [
                                      'overflow-hidden',
                                      'w-[calc(100vw-1.25rem)]',
                                      'rounded-[22px]',
                                      'border border-slate-200/90',
                                      'bg-white',
                                      'shadow-[0_18px_46px_rgba(15,23,42,0.12)]',
                                      'sm:w-[420px]',
                                      'lg:w-[392px]',
                                  ].join(' ')
                                : whisperVisible && moduleWhisper
                                  ? [
                                        'h-[68px]',
                                        'w-[370px]',
                                        'max-w-[calc(100vw-2rem)]',
                                        'overflow-hidden',
                                        'rounded-[22px]',
                                        'border border-slate-800/70',
                                        'bg-[#151515]',
                                        'shadow-[0_16px_38px_rgba(15,23,42,0.24)]',
                                    ].join(' ')
                                  : [
                                        'h-[60px]',
                                        'w-[60px]',
                                        'overflow-visible',
                                        'rounded-full',
                                        'border-0',
                                        'bg-transparent',
                                        'shadow-none',
                                    ].join(' '),
                        ].join(' ')}
                        style={
                            {
                                height: open ? openHeight : undefined,
                                left:
                                    dockSide === 'left'
                                        ? `${leftDockTarget()}px`
                                        : undefined,
                                right:
                                    dockSide === 'right' ? '16px' : undefined,
                                transform:
                                    dragOffsetX !== 0
                                        ? `translate3d(${dragOffsetX}px, 0, 0)`
                                        : undefined,
                            } satisfies CSSProperties
                        }
                    >
                        {!open && !whisperVisible && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (suppressOrbClickRef.current) {
                                        suppressOrbClickRef.current = false;
                                        return;
                                    }

                                    morphTo(true);
                                }}
                                onPointerDown={beginHorizontalDrag}
                                onPointerMove={moveHorizontalDrag}
                                onPointerUp={endHorizontalDrag}
                                onPointerCancel={endHorizontalDrag}
                                className="aevyn-orb-idle group flex h-[60px] w-[60px] touch-none cursor-grab select-none items-center justify-center rounded-full transition duration-200 hover:-translate-y-0.5 hover:scale-[1.045] active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2"
                                aria-label="Open Aevyn"
                                title="Open Aevyn"
                            >
                                <img
                                    src={AEVYN_LOGO}
                                    alt="Aevyn"
                                    className="h-[58px] w-[58px] select-none object-contain drop-shadow-lg"
                                    draggable={false}
                                />
                            </button>
                        )}

                        {!open && whisperVisible && moduleWhisper && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (suppressOrbClickRef.current) {
                                        suppressOrbClickRef.current = false;
                                        return;
                                    }

                                    morphTo(true);
                                }}
                                onPointerDown={beginHorizontalDrag}
                                onPointerMove={moveHorizontalDrag}
                                onPointerUp={endHorizontalDrag}
                                onPointerCancel={endHorizontalDrag}
                                className="aevyn-whisper-content flex h-full w-full touch-none cursor-grab select-none items-center gap-3 px-2.5 pr-4 text-left active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                aria-label={`Open Aevyn: ${moduleWhisper.message}`}
                            >
                                <img
                                    src={AEVYN_LOGO}
                                    alt=""
                                    aria-hidden="true"
                                    className="h-12 w-12 shrink-0 select-none object-contain"
                                    draggable={false}
                                />

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className={[
                                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                                moduleWhisper.tone === 'warning'
                                                    ? 'bg-amber-400'
                                                    : 'bg-emerald-400',
                                            ].join(' ')}
                                        />
                                        <span className="text-[9px] font-bold uppercase tracking-[0.13em] text-white/65">
                                            {moduleWhisper.module}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.10em] text-white/45">
                                            update
                                        </span>
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-[15px] text-white/90">
                                        {moduleWhisper.message}
                                    </p>
                                </div>
                            </button>
                        )}

                        {open && (
                            <div className="aevyn-chat-content flex h-full min-h-0 flex-col overflow-hidden">
                                <header
                                    onPointerDown={beginHorizontalDrag}
                                    onPointerMove={moveHorizontalDrag}
                                    onPointerUp={endHorizontalDrag}
                                    onPointerCancel={endHorizontalDrag}
                                    className="relative h-[66px] shrink-0 touch-none cursor-grab select-none border-b border-slate-200/90 bg-white/98 px-3.5 text-slate-900 active:cursor-grabbing"
                                >
                                    <div className="flex h-full items-center gap-3">
                                        <img
                                            src={AEVYN_LOGO}
                                            alt="Aevyn"
                                            className="h-10 w-10 shrink-0 select-none object-contain"
                                            draggable={false}
                                        />

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h2 className="truncate text-sm font-semibold tracking-tight text-slate-900">
                                                    Aevyn
                                                </h2>
                                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.13em] text-emerald-700">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                    Online
                                                </span>
                                            </div>
                                            <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
                                                AI Workforce Intelligence
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onPointerDown={(event) =>
                                                event.stopPropagation()
                                            }
                                            onClick={() => morphTo(false)}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition duration-150 hover:bg-slate-100 hover:text-slate-700"
                                            aria-label="Close Aevyn"
                                            title="Close Aevyn"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </header>

                                <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc]">
                                    {!hasConversation ? (
                                        <div className="flex min-h-full flex-col items-center justify-center px-5 py-8">
                                            <h3 className="text-lg font-semibold tracking-tight text-slate-900">
                                                How can Aevyn help?
                                            </h3>

                                            <p className="mt-2 max-w-[310px] text-center text-xs leading-5 text-slate-500">
                                                Suggestions follow what you are viewing now, but you can also ask about your connected learning, training, development, certificates, or notifications.
                                            </p>
                                            {connectedContextLoading && isLearnerPersona && (
                                                <p className="mt-2 text-[10px] font-medium text-slate-400">Refreshing your authorized LMS context…</p>
                                            )}

                                            <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-2">
                                                {quickPrompts.map((prompt) => (
                                                    <button
                                                        key={prompt}
                                                        type="button"
                                                        onClick={() =>
                                                            applyQuickPrompt(prompt)
                                                        }
                                                        className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-[11px] font-medium leading-4 text-slate-600 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
                                                    >
                                                        {prompt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 px-3 py-4">
                                            {messages.slice(1).map((message) => (
                                                <div
                                                    key={message.id}
                                                    className={[
                                                        'flex min-w-0',
                                                        message.role === 'user'
                                                            ? 'justify-end'
                                                            : 'justify-start',
                                                    ].join(' ')}
                                                >
                                                    <div
                                                        className={[
                                                            'max-w-[86%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13px] leading-5 shadow-sm',
                                                            message.role === 'user'
                                                                ? 'rounded-br-md bg-slate-900 text-white'
                                                                : 'rounded-bl-md border border-slate-200 bg-white text-slate-700',
                                                        ].join(' ')}
                                                    >
                                                        {message.content}
                                                    </div>
                                                </div>
                                            ))}

                                            {loading && (
                                                <div className="flex justify-start">
                                                    <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-500 shadow-sm">
                                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                                        <span>Aevyn is thinking...</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div ref={messagesEndRef} />
                                        </div>
                                    )}
                                </div>

                                <footer className="shrink-0 border-t border-slate-200 bg-white p-3">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 transition duration-150 focus-within:border-slate-300 focus-within:bg-white focus-within:shadow-sm">
                                        <textarea
                                            ref={textareaRef}
                                            value={input}
                                            onChange={(event) =>
                                                setInput(event.target.value)
                                            }
                                            onKeyDown={handleKeyDown}
                                            rows={1}
                                            placeholder="Message Aevyn..."
                                            className="max-h-32 min-h-[42px] w-full resize-none overflow-x-hidden border-0 bg-transparent px-2 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0"
                                        />

                                        <div className="mt-1 flex items-center justify-between gap-2 px-1">
                                            <span className="text-[9px] text-slate-400">
                                                Enter to send
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() => void sendMessage()}
                                                disabled={!canSend}
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white transition duration-150 hover:scale-105 hover:bg-black disabled:cursor-not-allowed disabled:opacity-35"
                                                aria-label="Send message"
                                            >
                                                {loading ? (
                                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <ArrowUp className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <p className="mt-2 text-center text-[8px] font-medium uppercase tracking-[0.15em] text-slate-400">
                                        Aevyn · Powered by Groq
                                    </p>
                                </footer>
                            </div>
                        )}
                    </section>,
                    document.body,
                )}
        </>
    );
}

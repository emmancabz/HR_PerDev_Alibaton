import { Config } from 'ziggy-js';

export type UserRole = 'admin' | 'hr' | 'user';
export type UserPersona = 'trainee' | 'employee' | 'supervisor' | 'manager';

export interface User {
    id: number;
    name: string;
    email: string;
    profile_photo_url: string | null;
    role: UserRole;
    personnel_key: string | null;
    core_person_id: string | null;
    employee_or_trainee_id: string | null;
    position: string | null;
    department: string | null;
    person_type: string | null;
    employment_status: string | null;
    evaluator_capable: boolean;
    manager_id: number | null;
    persona: UserPersona;
    persona_label: string;
    email_verified_at: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
    };
    securitySessionTimeoutMinutes: number;
    ziggy: Config & { location: string };
};

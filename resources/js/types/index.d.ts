import { Config } from 'ziggy-js';

export type UserRole = 'admin' | 'manager' | 'employee';

export interface User {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    email_verified_at: string | null;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
    };
    ziggy: Config & { location: string };
};

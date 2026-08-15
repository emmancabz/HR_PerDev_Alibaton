import { useMemo } from 'react';

interface PasswordStrengthIndicatorProps {
    password: string;
}

interface StrengthResult {
    score: number; // 0-4
    label: string;
    color: string;
    bgColor: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
    const strength = useMemo((): StrengthResult => {
        if (!password) {
            return { score: 0, label: '', color: '', bgColor: '' };
        }

        let score = 0;
        
        // Length check
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        
        // Character variety checks
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        // Map score to strength levels
        if (score <= 1) {
            return {
                score: 1,
                label: 'Weak',
                color: 'text-red-600',
                bgColor: 'bg-red-500'
            };
        } else if (score === 2) {
            return {
                score: 2,
                label: 'Fair',
                color: 'text-orange-600',
                bgColor: 'bg-orange-500'
            };
        } else if (score === 3) {
            return {
                score: 3,
                label: 'Good',
                color: 'text-blue-600',
                bgColor: 'bg-blue-500'
            };
        } else {
            return {
                score: 4,
                label: 'Strong',
                color: 'text-emerald-600',
                bgColor: 'bg-emerald-500'
            };
        }
    }, [password]);

    if (!password) return null;

    return (
        <div className="mt-2" role="status" aria-live="polite" aria-label={`Password strength: ${strength.label}`}>
            <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                    <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            level <= strength.score ? strength.bgColor : 'bg-slate-200'
                        }`}
                    />
                ))}
            </div>
            <p className={`mt-1.5 text-xs font-medium ${strength.color}`}>
                Password strength: {strength.label}
            </p>
        </div>
    );
}

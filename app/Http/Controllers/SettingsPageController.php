<?php

namespace App\Http\Controllers;

use App\Services\Governance\SystemSettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SettingsPageController extends Controller
{
    public function __construct(private readonly SystemSettingsService $settings) {}

    public function index(Request $request): Response
    {
        $initialWorkspace = match (true) {
            $request->query('section') === 'profile' => 'My Profile',
            $request->query('section') === 'security' => 'Sign-in Protection',
            $request->query('section') === 'security-activity' => 'Security Logs',
            $request->query('section') === 'notifications' => 'Notifications & Alerts',
            $request->query('section') === 'organization' => 'Organization & Reporting',
            $request->query('section') === 'archive' => 'Archive',
            $request->query('section') === 'faq' => 'FAQ',
            $request->query('section') === 'privacy' => 'Privacy Policy',
            $request->query('section') === 'terms' => 'Terms of Service',
            $request->query('section') === 'license' => 'Software License',
            $request->routeIs('admin.integrations.index') => 'Notifications & Alerts',
            $request->routeIs('admin.audit.index') => 'Audit Trail',
            default => 'My Profile',
        };

        return Inertia::render('Settings', [
            'initialSettingsState' => $this->settings->state($request->user(), $request),
            'initialWorkspace' => $initialWorkspace,
        ]);
    }
}

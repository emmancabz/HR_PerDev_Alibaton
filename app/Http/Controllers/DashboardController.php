<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): RedirectResponse
    {
        return $this->redirectToOwnedDashboard($request->user());
    }

    public function admin(Request $request): Response
    {
        return Inertia::render('AdminDashboard', [
            'userName' => $request->user()->name,
        ]);
    }

    public function hr(Request $request): Response
    {
        return Inertia::render('HRDashboard', [
            'userName' => $request->user()->name,
        ]);
    }

    public function user(Request $request): Response
    {
        return Inertia::render('UserDashboard', [
            'userName' => $request->user()->name,
        ]);
    }

    public function redirectToOwnedDashboard(User $user): RedirectResponse
    {
        $role = $user->role instanceof UserRole ? $user->role : UserRole::User;

        return redirect()->route($role->dashboardRouteName());
    }
}
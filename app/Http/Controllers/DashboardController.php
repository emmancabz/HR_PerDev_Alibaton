<?php

namespace App\Http\Controllers;

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

    public function manager(Request $request): Response
    {
        return Inertia::render('ManagerDashboard', [
            'userName' => $request->user()->name,
        ]);
    }

    public function employee(Request $request): Response
    {
        return Inertia::render('EmployeeDashboard', [
            'userName' => $request->user()->name,
        ]);
    }

    public function redirectToOwnedDashboard(User $user): RedirectResponse
    {
        return redirect()->route($user->role->dashboardRouteName());
    }
}

<?php

namespace App\Console\Commands;

use App\Services\Governance\AccountArchiveService;
use Illuminate\Console\Command;

class AnonymizeExpiredAccounts extends Command
{
    protected $signature = 'accounts:anonymize-expired';

    protected $description = 'Permanently remove personal identity from archived accounts whose governed retention period has expired';

    public function handle(AccountArchiveService $archive): int
    {
        $count = $archive->anonymizeExpired();
        $this->info("Deleted retained identity for {$count} expired archived account(s); de-identified references were preserved.");

        return self::SUCCESS;
    }
}

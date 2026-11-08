<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Daily so a deleted-history promise is kept without hammering the table.
 * The retention window itself is still a placeholder — see config/history.php.
 */
Schedule::command('history:prune')->daily()->withoutOverlapping();

/*
 * Daily: post any recurring budget transactions that have fallen due and
 * advance their schedules. See App\Console\Commands\RunRecurringTransactions.
 */
Schedule::command('budget:run-recurring')->daily()->withoutOverlapping();

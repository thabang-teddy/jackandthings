<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

class InsufficientFundsException extends RuntimeException
{
    public static function forAccount(string $accountName, int $balanceCents, int $requestedCents): self
    {
        return new self(sprintf(
            'Account "%s" holds %d cents, which cannot cover %d cents.',
            $accountName,
            $balanceCents,
            $requestedCents,
        ));
    }
}

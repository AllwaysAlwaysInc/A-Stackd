/**
 * Domain errors carry an HTTP status and a stable machine-readable code so the
 * route layer can translate them into clean API responses without leaking
 * internals of the air-gapped Floor.
 */
export class DomainError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class PoolNotFoundError extends DomainError {
  constructor(poolId: string) {
    super(404, "POOL_NOT_FOUND", `Pool '${poolId}' does not exist.`);
  }
}

export class PoolClosedError extends DomainError {
  constructor(poolId: string) {
    super(409, "POOL_CLOSED", `Pool '${poolId}' is no longer accepting tickets.`);
  }
}

export class PoolFullError extends DomainError {
  constructor(poolId: string) {
    super(409, "POOL_FULL", `Pool '${poolId}' does not have enough open seats.`);
  }
}

export class InvalidChipForPoolError extends DomainError {
  constructor(poolId: string, required: string) {
    super(
      422,
      "INVALID_CHIP_FOR_POOL",
      `Pool '${poolId}' accepts a '${required}' chip or a 'black' chip only.`,
    );
  }
}

export class InsufficientChipsError extends DomainError {
  constructor(color: string) {
    super(402, "INSUFFICIENT_CHIPS", `Not enough '${color}' chips in your stack.`);
  }
}

export class WhaleLimitError extends DomainError {
  constructor(poolId: string) {
    super(
      429,
      "WHALE_LIMIT_REACHED",
      `Max one black chip per person per pool. You have already dropped black on '${poolId}'.`,
    );
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Missing or invalid credentials.") {
    super(401, "UNAUTHORIZED", message);
  }
}

export class PoolAlreadyDrawnError extends DomainError {
  constructor(poolId: string) {
    super(409, "POOL_ALREADY_DRAWN", `Pool '${poolId}' has already been drawn.`);
  }
}

export class PoolNotDrawableError extends DomainError {
  constructor(poolId: string) {
    super(
      409,
      "POOL_NOT_DRAWABLE",
      `Pool '${poolId}' is still open and not yet full; it cannot be drawn.`,
    );
  }
}

export class NoTicketsError extends DomainError {
  constructor(poolId: string) {
    super(409, "NO_TICKETS", `Pool '${poolId}' has no tickets to draw from.`);
  }
}

export class PoolExistsError extends DomainError {
  constructor(poolId: string) {
    super(409, "POOL_EXISTS", `Pool '${poolId}' already exists.`);
  }
}

export class EmailInUseError extends DomainError {
  constructor(email: string) {
    super(409, "EMAIL_IN_USE", `An account already exists for '${email}'.`);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super(401, "INVALID_CREDENTIALS", "Incorrect email or password.");
  }
}

class DomainError(Exception):
    """A rule of the app was broken (e.g. 'a timer is already running').

    Services raise it; views turn it into an Inertia error on `field`.
    .NET: like throwing a custom DomainException that a filter maps to ModelState.
    """

    def __init__(self, message: str, field: str = "__all__"):
        super().__init__(message)
        self.message = message
        self.field = field

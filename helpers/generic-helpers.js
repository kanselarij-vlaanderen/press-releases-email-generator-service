export function handleGenericError(e, next) {
    console.error(e);
    e.status = 500;
    return next(e);
}

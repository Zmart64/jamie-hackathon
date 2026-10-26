"""Consistent JSON errors without echoing request bodies or provider internals."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from support_agent.models import ErrorDetail, ErrorResponse

HTTP_ERROR_CODES = {
    404: "not_found",
    405: "method_not_allowed",
    409: "session_busy",
}


def install_error_handlers(app: FastAPI) -> None:
    """Use error.code/error.message for request failures and failed agent turns alike."""

    @app.exception_handler(HTTPException)
    async def http_error(_request: Request, error: HTTPException) -> JSONResponse:
        body = ErrorResponse(
            error=ErrorDetail(
                code=HTTP_ERROR_CODES.get(error.status_code, "request_failed"),
                message=str(error.detail),
            )
        )
        return JSONResponse(
            status_code=error.status_code,
            content=body.model_dump(mode="json"),
            headers=error.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_request: Request, _error: RequestValidationError) -> JSONResponse:
        body = ErrorResponse(
            error=ErrorDetail(
                code="invalid_request",
                message="Invalid request. Check the body and parameters against the API schema.",
            )
        )
        return JSONResponse(status_code=422, content=body.model_dump(mode="json"))

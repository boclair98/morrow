package kr.morrow.api.web

import jakarta.validation.ConstraintViolationException
import kr.morrow.api.service.ApiException
import org.slf4j.LoggerFactory
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice
class ApiExceptionHandler {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(ApiException::class)
    fun api(error: ApiException): ResponseEntity<Map<String, String>> =
        ResponseEntity.status(error.status).body(mapOf("detail" to error.message))

    @ExceptionHandler(MethodArgumentNotValidException::class, ConstraintViolationException::class, HttpMessageNotReadableException::class)
    fun invalid(error: Exception): ResponseEntity<Map<String, String>> {
        val detail = if (error is MethodArgumentNotValidException) {
            error.bindingResult.fieldErrors.firstOrNull()?.defaultMessage ?: "입력값을 확인해주세요"
        } else "입력값을 확인해주세요"
        return ResponseEntity.status(422).body(mapOf("detail" to detail))
    }

    @ExceptionHandler(DataIntegrityViolationException::class)
    fun conflict(error: DataIntegrityViolationException): ResponseEntity<Map<String, String>> =
        ResponseEntity.status(409).body(mapOf("detail" to "이미 처리된 요청이에요"))

    @ExceptionHandler(Exception::class)
    fun unexpected(error: Exception): ResponseEntity<Map<String, String>> {
        log.error("Unhandled API error", error)
        return ResponseEntity.status(500).body(mapOf("detail" to "요청을 처리하지 못했어요"))
    }
}

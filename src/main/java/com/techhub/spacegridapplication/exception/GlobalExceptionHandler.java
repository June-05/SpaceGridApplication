package com.techhub.spacegridapplication.exception;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

/**
 * Catches errors from every controller in one place and sends JSON like {"error": "Property not found."}.
 * The pages' api.js reads this "error" field and shows it to the user.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(SpaceGridException.class)
    public ResponseEntity<Map<String, String>> handleSpaceGridException(SpaceGridException ex) {
        return ResponseEntity.status(ex.getHttpStatus()).body(Map.of("error", ex.getMessage()));
    }

    /** Missing or badly formatted request data (e.g. rows=abc, a missing form field, broken JSON). */
    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> handleBadRequest(Exception ex) {
        log.debug("Bad request: {}", ex.getMessage());
        return ResponseEntity.status(400).body(Map.of("error", "Some of the submitted data is missing or invalid."));
    }

    /** A page or file that doesn't exist (e.g. /favicon.ico): a normal 404, not an error. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> handleNoResource(NoResourceFoundException ex) {
        return ResponseEntity.status(404).body(Map.of("error", "Not found."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleUnexpected(Exception ex) {
        if (ex instanceof UnsupportedOperationException) {          // a skeleton method that is still a TODO
            log.warn("Not implemented yet", ex);
            return ResponseEntity.status(501).body(Map.of("error", "This feature isn't implemented yet."));
        }
        log.error("Unexpected error", ex);
        return ResponseEntity.status(500).body(Map.of("error", "Something went wrong. Please try again."));
    }
}

package kr.morrow.api.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import kr.morrow.api.service.IdentityService
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import org.springframework.web.client.RestClient

@Configuration
class SecurityConfig {
    @Bean
    fun restClientBuilder(): RestClient.Builder = RestClient.builder()

    @Bean
    fun securityFilterChain(http: HttpSecurity, identityFilter: MorrowIdentityFilter): SecurityFilterChain {
        http
            .csrf { it.disable() }
            .formLogin { it.disable() }
            .httpBasic { it.disable() }
            .logout { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { auth ->
                auth
                    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                    .requestMatchers("/api/health", "/api/health/live", "/api/health/ready", "/api/auth/providers").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/push/config").permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/*/start").permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/auth/*/callback").permitAll()
                    .requestMatchers("/actuator/health/**").permitAll()
                    .anyRequest().authenticated()
            }
            .exceptionHandling { errors ->
                errors.authenticationEntryPoint { _, response, _ ->
                    response.status = 401
                    response.contentType = "application/json;charset=UTF-8"
                    response.writer.write("{\"detail\":\"로그인이 필요해요\"}")
                }
            }
            .addFilterBefore(identityFilter, AnonymousAuthenticationFilter::class.java)
        return http.build()
    }
}

@Component
class MorrowIdentityFilter(
    private val properties: MorrowProperties,
    private val identityService: IdentityService,
) : OncePerRequestFilter() {
    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val cookie = request.cookies?.firstOrNull { it.name == properties.sessionCookieName }?.value
        val authentication = identityService.resolve(cookie, request.getHeader("X-Coders-User"))
        if (authentication != null) {
            SecurityContextHolder.getContext().authentication = authentication
        }
        try {
            chain.doFilter(request, response)
        } finally {
            SecurityContextHolder.clearContext()
        }
    }
}


package kr.morrow.api

import kr.morrow.api.config.MorrowProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication(exclude = [UserDetailsServiceAutoConfiguration::class])
@EnableConfigurationProperties(MorrowProperties::class)
@EnableScheduling
class MorrowApiApplication

fun main(args: Array<String>) {
    runApplication<MorrowApiApplication>(*args)
}

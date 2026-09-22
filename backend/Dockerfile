FROM gradle:9.7.1-jdk21-alpine AS build

WORKDIR /workspace
COPY --chown=gradle:gradle build.gradle.kts settings.gradle.kts ./
COPY --chown=gradle:gradle src ./src
RUN gradle --no-daemon --stacktrace bootJar

FROM eclipse-temurin:25.0.4_7-jre-alpine

RUN addgroup -S morrow && adduser -S -u 1001 -G morrow morrow
WORKDIR /app
COPY --from=build /workspace/build/libs/morrow-api-2.0.0.jar /app/morrow-api.jar

ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 --enable-native-access=ALL-UNNAMED -Dfile.encoding=UTF-8"
USER morrow
EXPOSE 8000
ENTRYPOINT ["java", "-jar", "/app/morrow-api.jar"]

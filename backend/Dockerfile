# ---- build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY pom.xml ./
RUN mvn -q -B -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- runtime stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -r app && useradd -r -g app app \
    && mkdir -p /data && chown -R app:app /data /app
USER app

COPY --from=build /workspace/target/personal-finance-tracker.jar /app/app.jar

ENV PFT_DB_URL=jdbc:sqlite:/data/pft.db \
    JAVA_OPTS=""
VOLUME ["/data"]
EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]

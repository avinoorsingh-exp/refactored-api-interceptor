@Library('jenkins-library') _

pipeline
{
  agent any
  stages
  {
    stage('Build preparations') {
      steps {
        script {
          gitCommitHash = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
          shortCommitHash = gitCommitHash.take(7)
          env.VERSION = shortCommitHash
          currentBuild.displayName = "#${BUILD_ID}-${env.VERSION}"
          
          def imageTag = ''
          def sanitizedBranchName = env.BRANCH_NAME.replaceAll('/', '-')
          if (env.BRANCH_NAME == 'dev') {
              imageTag = "${env.PROJECT}:dev-${env.VERSION}"
          } else if (env.BRANCH_NAME == 'test') {
              imageTag = "${env.PROJECT}:test-${env.VERSION}"
          } else if (env.BRANCH_NAME == 'accp') {
              imageTag = "${env.PROJECT}:accp-${env.VERSION}"
          } else if (env.BRANCH_NAME == 'qa') {
              imageTag = "${env.PROJECT}:qa-${env.VERSION}"
          } else if (env.BRANCH_NAME == 'main') {
              imageTag = "${env.PROJECT}:prod-${env.VERSION}"
          } else {
              imageTag = "${env.PROJECT}:${sanitizedBranchName}-${env.VERSION}"
          }
          env.IMAGE = imageTag
        }

      }
    }

    stage('Docker build') {
      steps {
        script {
          docker.build("${env.IMAGE}", "-f services/agent-service/Dockerfile .")
        }
      }
    }

    stage('Test + Coverage') {
      when {
        anyOf {
          branch 'dev'
          branch 'test'
          expression { env.BRANCH_NAME.startsWith('feature/') }
        }
      }
      steps {
        script {
          // Trigger centralized coverage job asynchronously (do not delay build; do not fail build)
          try {
            def ccJob = 'AgentService/agent-service-coverage/main'
            // Flip to `true` later if we decide to gate this pipeline on coverage/test results.
            def coverageWait = false
            def ccRun = build job: ccJob,
              wait: coverageWait,
              propagate: false,
                  parameters: [
                      string(name: 'SERVICE_NAME', value: 'agent-service'),
                      string(name: 'PROJECT_KEY', value: env.COVERAGE_PROJECT_KEY),
                      string(name: 'REPO_KEY', value: env.COVERAGE_REPO_KEY),
                      string(name: 'DEFAULT_BRANCH', value: env.COVERAGE_DEFAULT_BRANCH),
                      string(name: 'BRANCH_NAME', value: env.BRANCH_NAME),
                      string(name: 'REPO_URL', value: env.GIT_URL),
                      string(name: 'COVERAGE_DIR', value: 'services/agent-service/coverage'),
                      booleanParam(name: 'RUN_E2E', value: true),
                      booleanParam(name: 'FAIL_ON_TEST_FAILURE', value: false),
                      // Per-metric thresholds (Jest/Istanbul totals)
                      string(name: 'MIN_LINE_COVERAGE', value: env.COVERAGE_MIN_LINE_COVERAGE),
                      string(name: 'MIN_BRANCH_COVERAGE', value: env.COVERAGE_MIN_BRANCH_COVERAGE),
                      string(name: 'MIN_METHOD_COVERAGE', value: env.COVERAGE_MIN_METHOD_COVERAGE),
                      string(name: 'MIN_STMT_COVERAGE', value: env.COVERAGE_MIN_STMT_COVERAGE),
                      booleanParam(name: 'FAIL_ON_COVERAGE_THRESHOLD', value: (env.COVERAGE_FAIL_ON_THRESHOLD ?: 'true').toBoolean())
                  ]
            def base = (env.JENKINS_URL ?: '').toString().trim()
            def ccJobUrl = base ? "${base}job/AgentService/job/agent-service-coverage/job/main/" : ccJob
            env.COVERAGE_STATUS = (coverageWait ? (ccRun?.result ?: 'UNKNOWN') : 'TRIGGERED').toString()
            env.COVERAGE_URL = (coverageWait ? (ccRun?.absoluteUrl ?: ccJobUrl) : ccJobUrl).toString()
            if (coverageWait) {
              if (ccRun?.result && ccRun.result != 'SUCCESS') {
                def ccUrl = ccRun?.absoluteUrl ?: ccJobUrl
                error("AgentService coverage job failed (${ccRun.result}). See: ${ccUrl}")
              }
            } else {
              echo "ℹ️  INFO: AgentService coverage job triggered (async, non-blocking): ${ccJobUrl}"
            }
          } catch (org.jenkinsci.plugins.workflow.steps.FlowInterruptedException e) {
            // FlowInterruptedException is expected when wait: false and downstream job returns UNSTABLE/FAILURE
            // This is not a real error - the job was triggered successfully
            echo "ℹ️  INFO: AgentService coverage job trigger interrupted (non-blocking): ${e.getMessage()}"
            env.COVERAGE_STATUS = 'TRIGGER_INTERRUPTED'
          } catch (Exception e) {
            // Log error but don't fail the build
            echo "❌ DEBUG: Error calling AgentService coverage job: ${e.getClass().getSimpleName()}: ${e.getMessage()}"
            env.COVERAGE_STATUS = 'ERROR'
          }
        }
      }
    }

    stage('Docker push') {
      when {
        anyOf {
          branch 'development'
          branch 'dev'
          branch 'qa'
          branch 'test'
          branch 'accp'
          branch 'main'
        }
      }
      steps {
        script {
          loginHelpers.dockerLogin()
          ECRURL = "http://${ECR}"
          docker.withRegistry(ECRURL) {
            docker.image(env.IMAGE).push()
          }
          TF_VAR_app_image = "${ECR}${env.IMAGE}"
          env.TF_VAR_app_image = TF_VAR_app_image
          writeFile file: 'image-tag.txt', text: TF_VAR_app_image
        }

      }
    }

    stage('Fetch Database Secrets') {
      steps {
        script {
          def secretName = ''
          def credentialsId = ''
          
          if (env.BRANCH_NAME == 'dev') {
            secretName = 'dev/agent-service-dev'
            credentialsId = 'Jenkins-Dev'
          } else if (env.BRANCH_NAME == 'test') {
            secretName = 'dev/agent-service-test'
            credentialsId = 'Jenkins-Dev'
          } else if (env.BRANCH_NAME == 'qa') {
            secretName = 'qa/agent-service-accp'
            credentialsId = 'jenkins-qa-user'
          } else if (env.BRANCH_NAME == 'accp') {
            secretName = 'qa/agent-service-accp'
            credentialsId = 'jenkins-qa-user'
          } else if (env.BRANCH_NAME == 'main') {
            secretName = 'prod/agent-service-prod'
            credentialsId = '88caba18-4691-47c5-92a9-e66ee83da4e4'
          }

          // Create AWS config file for Secrets Manager access
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_DEV,
            profileName: 'exp-dev',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID
          ])
          
          sh """
            export AWS_PROFILE=exp-dev
            aws secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query 'SecretString' --output text > db-secrets.json
            """
          
          // Cleanup config file
          sh 'sudo rm -rf .aws'
        }
      }
    }

    stage('Run Migrations - Development') {
      when {
        branch 'dev'
      }

      steps {
        script {
          docker.image('node:20-alpine')
            .inside("-u 0 -v $WORKSPACE:/app -w /app") {
              sh """
              apk add --no-cache jq python3 make g++ curl
              npm install -g pnpm

              # Debug: Show available keys in secrets JSON
              echo "=== Available keys in db-secrets.json ==="
              cat db-secrets.json | jq -r 'keys[]' || echo "Failed to parse JSON"
              echo ""

              # Extract database credentials with fallback to alternative field names
              export DB_HOST=\$(cat db-secrets.json | jq -r '.DB_HOST // .host // .database_host // .DATABASE_HOST // empty')
              export DB_PORT=\$(cat db-secrets.json | jq -r '.DB_PORT // .port // .database_port // .DATABASE_PORT // "5432"')
              export DB_USERNAME=\$(cat db-secrets.json | jq -r '.DB_USERNAME // .username // .database_username // .DATABASE_USERNAME // .user // .USER // empty')
              export DB_PASSWORD=\$(cat db-secrets.json | jq -r '.DB_PASSWORD // .password // .database_password // .DATABASE_PASSWORD // empty')
              export DB_NAME=\$(cat db-secrets.json | jq -r '.DB_NAME // .database_name // .DATABASE_NAME // .database // .DATABASE // empty')

              # Validate required fields (fail if null or empty)
              if [ -z "\$DB_HOST" ] || [ "\$DB_HOST" == "null" ]; then
                echo "ERROR: DB_HOST is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                echo "Full secrets (masked):"
                cat db-secrets.json | jq 'with_entries(if .key | contains("PASS") or contains("SECRET") then .value = "***REDACTED***" else . end)'
                exit 1
              fi
              if [ -z "\$DB_USERNAME" ] || [ "\$DB_USERNAME" == "null" ]; then
                echo "ERROR: DB_USERNAME is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                exit 1
              fi
              if [ -z "\$DB_PASSWORD" ] || [ "\$DB_PASSWORD" == "null" ]; then
                echo "ERROR: DB_PASSWORD is missing or null"
                exit 1
              fi
              if [ -z "\$DB_NAME" ] || [ "\$DB_NAME" == "null" ]; then
                echo "ERROR: DB_NAME is missing or null"
                exit 1
              fi

              # Debug: Show extracted values (mask password)
              echo "=== Database configuration ==="
              echo "DB_HOST: \$DB_HOST"
              echo "DB_PORT: \$DB_PORT"
              echo "DB_USERNAME: \$DB_USERNAME"
              echo "DB_PASSWORD: [REDACTED]"
              echo "DB_NAME: \$DB_NAME"
              echo ""

              # Download AWS RDS CA certificate bundle for SSL connections
              echo "=== Downloading AWS RDS CA certificate ==="
              curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem || {
                echo "Failed to download RDS CA certificate, trying regional bundle..."
                curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem || {
                  echo "ERROR: Failed to download RDS CA certificate"
                  exit 1
                }
              }
              chmod 644 /tmp/rds-ca-bundle.pem
              export DB_SSL=true
              export DB_SSL_CA_PATH=/tmp/rds-ca-bundle.pem
              echo "RDS CA certificate downloaded to /tmp/rds-ca-bundle.pem"
              echo ""

              echo "=== Installing dependencies ==="
              pnpm install --frozen-lockfile
              
              echo "=== Building workspace packages ==="
              pnpm build:packages
              
              echo "=== Running migrations ==="
              pnpm migration:run
              """
            }
        }
      }
    }

    stage('Deploy - Development') {
      when {
        branch 'dev'
      }

      steps
      {
        
        script {
          // Step 1: Login to ECR for pulling terraform image
          loginHelpers.dockerLogin()
          
          // Step 2: Checkout terraform repository
          loginHelpers.checkoutTerraformRepo('exp-tf-dev', 'master')
          
          // Step 3: Create AWS config file
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_DEV,
            profileName: 'exp-dev',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID
          ])
          
          def dockerArgs = loginHelpers.getTerragruntDockerArgs([awsProfile: 'exp-dev'])
            docker.image(loginHelpers.getTerraformImage())
                .inside(dockerArgs) {
                  sh """
                  export AWS_PROFILE=exp-dev

                                                      
                  IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                  cd account/exp-realty-dev/us-east-1/agent-service/dev/agent-service-dev/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                  terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                  """
                }
          
          // Step 5: Cleanup config file
          sh 'sudo rm -rf .aws'
        }
        }
    }

    stage('Run Migrations - Test') {
      when {
        branch 'test'
      }

      steps {
        script {
          docker.image('node:20-alpine')
            .inside("-u 0 -v $WORKSPACE:/app -w /app") {
              sh """
              apk add --no-cache jq python3 make g++ curl
              npm install -g pnpm

              # Debug: Show available keys in secrets JSON
              echo "=== Available keys in db-secrets.json ==="
              cat db-secrets.json | jq -r 'keys[]' || echo "Failed to parse JSON"
              echo ""

              # Extract database credentials with fallback to alternative field names
              export DB_HOST=\$(cat db-secrets.json | jq -r '.DB_HOST // .host // .database_host // .DATABASE_HOST // empty')
              export DB_PORT=\$(cat db-secrets.json | jq -r '.DB_PORT // .port // .database_port // .DATABASE_PORT // "5432"')
              export DB_USERNAME=\$(cat db-secrets.json | jq -r '.DB_USERNAME // .username // .database_username // .DATABASE_USERNAME // .user // .USER // empty')
              export DB_PASSWORD=\$(cat db-secrets.json | jq -r '.DB_PASSWORD // .password // .database_password // .DATABASE_PASSWORD // empty')
              export DB_NAME=\$(cat db-secrets.json | jq -r '.DB_NAME // .database_name // .DATABASE_NAME // .database // .DATABASE // empty')

              # Validate required fields (fail if null or empty)
              if [ -z "\$DB_HOST" ] || [ "\$DB_HOST" == "null" ]; then
                echo "ERROR: DB_HOST is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                echo "Full secrets (masked):"
                cat db-secrets.json | jq 'with_entries(if .key | contains("PASS") or contains("SECRET") then .value = "***REDACTED***" else . end)'
                exit 1
              fi
              if [ -z "\$DB_USERNAME" ] || [ "\$DB_USERNAME" == "null" ]; then
                echo "ERROR: DB_USERNAME is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                exit 1
              fi
              if [ -z "\$DB_PASSWORD" ] || [ "\$DB_PASSWORD" == "null" ]; then
                echo "ERROR: DB_PASSWORD is missing or null"
                exit 1
              fi
              if [ -z "\$DB_NAME" ] || [ "\$DB_NAME" == "null" ]; then
                echo "ERROR: DB_NAME is missing or null"
                exit 1
              fi

              # Debug: Show extracted values (mask password)
              echo "=== Database configuration ==="
              echo "DB_HOST: \$DB_HOST"
              echo "DB_PORT: \$DB_PORT"
              echo "DB_USERNAME: \$DB_USERNAME"
              echo "DB_PASSWORD: [REDACTED]"
              echo "DB_NAME: \$DB_NAME"
              echo ""

              # Download AWS RDS CA certificate bundle for SSL connections
              echo "=== Downloading AWS RDS CA certificate ==="
              curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem || {
                echo "Failed to download RDS CA certificate, trying regional bundle..."
                curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem || {
                  echo "ERROR: Failed to download RDS CA certificate"
                  exit 1
                }
              }
              chmod 644 /tmp/rds-ca-bundle.pem
              export DB_SSL=true
              export DB_SSL_CA_PATH=/tmp/rds-ca-bundle.pem
              echo "RDS CA certificate downloaded to /tmp/rds-ca-bundle.pem"
              echo ""

              echo "=== Installing dependencies ==="
              pnpm install --frozen-lockfile
              
              echo "=== Building workspace packages ==="
              pnpm build:packages
              
              echo "=== Running migrations ==="
              pnpm migration:run
              """
            }
        }
      }
    }

    stage('Deploy - Test') {
      when {
        branch 'test'
      }

      steps
      {
        
        script {
          // Step 1: Login to ECR for pulling terraform image
          loginHelpers.dockerLogin()
          
          // Step 2: Checkout terraform repository
          loginHelpers.checkoutTerraformRepo('exp-tf-dev', 'master')
          
          // Step 3: Create AWS config file
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_DEV,
            profileName: 'exp-dev',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID
          ])
          
          def dockerArgs = loginHelpers.getTerragruntDockerArgs([awsProfile: 'exp-dev'])
            docker.image(loginHelpers.getTerraformImage())
                .inside(dockerArgs) {
                  sh """
                  export AWS_PROFILE=exp-dev

                                                      
                  IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                  cd account/exp-realty-dev/us-east-1/agent-service/test/agent-service-test/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                  terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                  """
                }
          
          // Step 5: Cleanup config file
          sh 'sudo rm -rf .aws'
        }
        }
    }

    stage('Run Migrations - QA/Acceptance') {
      when {
        anyOf {
          branch 'qa'
          branch 'accp'
        }
      }

      steps {
        script {
          docker.image('node:20-alpine')
            .inside("-u 0 -v $WORKSPACE:/app -w /app") {
              sh """
              apk add --no-cache jq python3 make g++ curl
              npm install -g pnpm

              # Debug: Show available keys in secrets JSON
              echo "=== Available keys in db-secrets.json ==="
              cat db-secrets.json | jq -r 'keys[]' || echo "Failed to parse JSON"
              echo ""

              # Extract database credentials with fallback to alternative field names
              export DB_HOST=\$(cat db-secrets.json | jq -r '.DB_HOST // .host // .database_host // .DATABASE_HOST // empty')
              export DB_PORT=\$(cat db-secrets.json | jq -r '.DB_PORT // .port // .database_port // .DATABASE_PORT // "5432"')
              export DB_USERNAME=\$(cat db-secrets.json | jq -r '.DB_USERNAME // .username // .database_username // .DATABASE_USERNAME // .user // .USER // empty')
              export DB_PASSWORD=\$(cat db-secrets.json | jq -r '.DB_PASSWORD // .password // .database_password // .DATABASE_PASSWORD // empty')
              export DB_NAME=\$(cat db-secrets.json | jq -r '.DB_NAME // .database_name // .DATABASE_NAME // .database // .DATABASE // empty')

              # Validate required fields (fail if null or empty)
              if [ -z "\$DB_HOST" ] || [ "\$DB_HOST" == "null" ]; then
                echo "ERROR: DB_HOST is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                echo "Full secrets (masked):"
                cat db-secrets.json | jq 'with_entries(if .key | contains("PASS") or contains("SECRET") then .value = "***REDACTED***" else . end)'
                exit 1
              fi
              if [ -z "\$DB_USERNAME" ] || [ "\$DB_USERNAME" == "null" ]; then
                echo "ERROR: DB_USERNAME is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                exit 1
              fi
              if [ -z "\$DB_PASSWORD" ] || [ "\$DB_PASSWORD" == "null" ]; then
                echo "ERROR: DB_PASSWORD is missing or null"
                exit 1
              fi
              if [ -z "\$DB_NAME" ] || [ "\$DB_NAME" == "null" ]; then
                echo "ERROR: DB_NAME is missing or null"
                exit 1
              fi

              # Debug: Show extracted values (mask password)
              echo "=== Database configuration ==="
              echo "DB_HOST: \$DB_HOST"
              echo "DB_PORT: \$DB_PORT"
              echo "DB_USERNAME: \$DB_USERNAME"
              echo "DB_PASSWORD: [REDACTED]"
              echo "DB_NAME: \$DB_NAME"
              echo ""

              # Download AWS RDS CA certificate bundle for SSL connections
              echo "=== Downloading AWS RDS CA certificate ==="
              curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem || {
                echo "Failed to download RDS CA certificate, trying regional bundle..."
                curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem || {
                  echo "ERROR: Failed to download RDS CA certificate"
                  exit 1
                }
              }
              chmod 644 /tmp/rds-ca-bundle.pem
              export DB_SSL=true
              export DB_SSL_CA_PATH=/tmp/rds-ca-bundle.pem
              echo "RDS CA certificate downloaded to /tmp/rds-ca-bundle.pem"
              echo ""

              echo "=== Installing dependencies ==="
              pnpm install --frozen-lockfile
              
              echo "=== Building workspace packages ==="
              pnpm build:packages
              
              echo "=== Running migrations ==="
              pnpm migration:run
              """
            }
        }
      }
    }

    stage('Deploy - QA/Acceptance') {
      when {
        anyOf {
          branch 'qa'
          branch 'accp'
        }
      }

      steps
      {
        
        script {
          // Step 1: Login to ECR for pulling terraform image
          loginHelpers.dockerLogin()
          
          // Step 2: Checkout terraform repository
          loginHelpers.checkoutTerraformRepo('exp-tf-qa', 'master')
          
          // Step 3: Create AWS config file
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_QA,
            profileName: 'exp-qa',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID
          ])
          
          def dockerArgs = loginHelpers.getTerragruntDockerArgs([awsProfile: 'exp-qa'])
            docker.image(loginHelpers.getTerraformImage())
                .inside(dockerArgs) {
                sh """
                  export AWS_PROFILE=exp-qa

                                                
                IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                cd /data/account/exp-realty-qa/us-east-1/agent-service/accp/agent-service-accp/ecs
                terragrunt init -reconfigure
                terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                """
              }
          
          // Step 5: Cleanup config file
          sh 'sudo rm -rf .aws'
        }
      }
    }

    stage('Run Migrations - Prod') {
      when {
        branch 'main'
      }

      steps {
        script {
          docker.image('node:20-alpine')
            .inside("-u 0 -v $WORKSPACE:/app -w /app") {
              sh """
              apk add --no-cache jq python3 make g++ curl
              npm install -g pnpm

              # Debug: Show available keys in secrets JSON
              echo "=== Available keys in db-secrets.json ==="
              cat db-secrets.json | jq -r 'keys[]' || echo "Failed to parse JSON"
              echo ""

              # Extract database credentials with fallback to alternative field names
              export DB_HOST=\$(cat db-secrets.json | jq -r '.DB_HOST // .host // .database_host // .DATABASE_HOST // empty')
              export DB_PORT=\$(cat db-secrets.json | jq -r '.DB_PORT // .port // .database_port // .DATABASE_PORT // "5432"')
              export DB_USERNAME=\$(cat db-secrets.json | jq -r '.DB_USERNAME // .username // .database_username // .DATABASE_USERNAME // .user // .USER // empty')
              export DB_PASSWORD=\$(cat db-secrets.json | jq -r '.DB_PASSWORD // .password // .database_password // .DATABASE_PASSWORD // empty')
              export DB_NAME=\$(cat db-secrets.json | jq -r '.DB_NAME // .database_name // .DATABASE_NAME // .database // .DATABASE // empty')

              # Validate required fields (fail if null or empty)
              if [ -z "\$DB_HOST" ] || [ "\$DB_HOST" == "null" ]; then
                echo "ERROR: DB_HOST is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                echo "Full secrets (masked):"
                cat db-secrets.json | jq 'with_entries(if .key | contains("PASS") or contains("SECRET") then .value = "***REDACTED***" else . end)'
                exit 1
              fi
              if [ -z "\$DB_USERNAME" ] || [ "\$DB_USERNAME" == "null" ]; then
                echo "ERROR: DB_USERNAME is missing or null"
                echo "Available keys in secrets:"
                cat db-secrets.json | jq 'keys'
                exit 1
              fi
              if [ -z "\$DB_PASSWORD" ] || [ "\$DB_PASSWORD" == "null" ]; then
                echo "ERROR: DB_PASSWORD is missing or null"
                exit 1
              fi
              if [ -z "\$DB_NAME" ] || [ "\$DB_NAME" == "null" ]; then
                echo "ERROR: DB_NAME is missing or null"
                exit 1
              fi

              # Debug: Show extracted values (mask password)
              echo "=== Database configuration ==="
              echo "DB_HOST: \$DB_HOST"
              echo "DB_PORT: \$DB_PORT"
              echo "DB_USERNAME: \$DB_USERNAME"
              echo "DB_PASSWORD: [REDACTED]"
              echo "DB_NAME: \$DB_NAME"
              echo ""

              # Download AWS RDS CA certificate bundle for SSL connections
              echo "=== Downloading AWS RDS CA certificate ==="
              curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem || {
                echo "Failed to download RDS CA certificate, trying regional bundle..."
                curl -o /tmp/rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem || {
                  echo "ERROR: Failed to download RDS CA certificate"
                  exit 1
                }
              }
              chmod 644 /tmp/rds-ca-bundle.pem
              export DB_SSL=true
              export DB_SSL_CA_PATH=/tmp/rds-ca-bundle.pem
              echo "RDS CA certificate downloaded to /tmp/rds-ca-bundle.pem"
              echo ""

              echo "=== Installing dependencies ==="
              pnpm install --frozen-lockfile
              
              echo "=== Building workspace packages ==="
              pnpm build:packages
              
              echo "=== Running migrations ==="
              pnpm migration:run
              """
            }
        }
      }
    }

    stage('Deploy - Prod') {
      when {
        branch 'main'
      }

      steps
      {
        
        script {
          // Step 1: Login to ECR for pulling terraform image
          loginHelpers.dockerLogin()
          
          // Step 2: Checkout terraform repository
          loginHelpers.checkoutTerraformRepo('exp-tf-prod', 'master')
          
          // Step 3: Create AWS config file
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_PROD,
            profileName: 'exp-production',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID
          ])
          
          def dockerArgs = loginHelpers.getTerragruntDockerArgs([awsProfile: 'exp-production'])
            docker.image(loginHelpers.getTerraformImage())
                .inside(dockerArgs) {
                sh """
                  export AWS_PROFILE=exp-production

                                                
                IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                cd /data/account/exp-realty-prod/us-east-1/agent-service/prod/agent-service/ecs
                terragrunt init -reconfigure
                terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                """
              }
          
          // Step 5: Cleanup config file
          sh 'sudo rm -rf .aws'
        }
      }
    }
  }
  environment {
    // Target account IDs
    TARGET_ACCOUNT_DEV = '125434132943'
    TARGET_ACCOUNT_QA = '427827735592'
    TARGET_ACCOUNT_PROD = '704132245682'
    ROLE_NAME = 'jenkins-cross-account-role'
    EXTERNAL_ID = 'jenkins-cross-account-access'
    
    AWS_DEFAULT_REGION = 'us-east-1'
    BITBUCKET_USER = 'exp-jenkins'

    PROJECT = 'exp/agent-service'
    ECRURL = ''
    TF_VAR_app_image = '99'
    ECR = '204048894727.dkr.ecr.us-east-1.amazonaws.com/'
    TF_LOG = 'ERROR'

    // Coverage dashboard grouping + centralized job params
    COVERAGE_PROJECT_KEY = 'AgentService'
    COVERAGE_REPO_KEY = 'agent-service'
    COVERAGE_DEFAULT_BRANCH = 'main'
    
    // Coverage gating (per-metric minimums). Jest/Istanbul mapping:
    // - lines      -> total.lines.pct
    // - branches   -> total.branches.pct
    // - methods    -> total.functions.pct
    // - statements -> total.statements.pct
    COVERAGE_FAIL_ON_THRESHOLD = 'true'
    COVERAGE_MIN_LINE_COVERAGE = '0'
    COVERAGE_MIN_BRANCH_COVERAGE = '0'
    COVERAGE_MIN_METHOD_COVERAGE = '0'
    COVERAGE_MIN_STMT_COVERAGE = '0'

    // Job pass/fail email addresses
    RECIPIENT_LIST='''
    devops@exprealty.net,
    michael.gatewood@exprealty.net,
    kyle.miller@exprealty.net,
    messbah.uddin@exprealty.net
    '''
  }
  post {
    always {
      script {
        def s = (env.COVERAGE_STATUS ?: 'NOT_RUN').toString()
        def u = (env.COVERAGE_URL ?: '').toString()
        echo "🧾 Coverage summary: ${s}${u ? " - ${u}" : ""}"
      }
      cleanWs()
      sh "docker rmi $TF_VAR_app_image | true"
    }
    success {
      script {
        CommonPostStepSuccess()
      }
    }
    failure {
      script {
        CommonPostStepFailure()
      }
    }
  }
  options {
    buildDiscarder(logRotator(numToKeepStr: '3'))
  }
}
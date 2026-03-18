@Library('jenkins-library') _

pipeline
{
  agent any
  stages
  {
    stage('Build preparations') {
      steps {
        script {
          def buildInfo = ecsDeployHelpers.prepareBuild([
            project: env.PROJECT,
            ecr: env.ECR
          ])
          ecsDeployHelpers.buildImage(buildInfo, '-f services/agent-service/Dockerfile .')
        }
      }
    }

    stage('Test ++ Coverage') {
      when {
        anyOf {
          branch 'dev'
          expression { env.BRANCH_NAME.startsWith('feature/') }
        }
      }
      steps {
        script {
          try {
            build job: 'Transaction Calculator/centralized-coverage/main',
              wait: false,
              propagate: false,
                  parameters: [
                      string(name: 'SERVICE_NAME', value: 'agent-service'),
                      string(name: 'BRANCH_NAME', value: env.BRANCH_NAME),
                      string(name: 'REPO_URL', value: env.GIT_URL),
                      string(name: 'COVERAGE_DIR', value: 'coverage'),
                      booleanParam(name: 'RUN_E2E', value: true),
                      booleanParam(name: 'FAIL_ON_TEST_FAILURE', value: false),
                      string(name: 'MIN_COVERAGE_PERCENTAGE', value: '0'),
                      booleanParam(name: 'FAIL_ON_COVERAGE_THRESHOLD', value: false)
                  ]
          } catch (org.jenkinsci.plugins.workflow.steps.FlowInterruptedException e) {
            // FlowInterruptedException is expected when wait: false and downstream job returns UNSTABLE
            // This is not a real error - the job was triggered successfully
          } catch (Exception e) {
            // Log error but don't fail the build
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
          def devSecOpsAccountId = '204048894727'
          def awsCfgDevSecops = loginHelpers.createRoleProfileConfig([
            accountId: devSecOpsAccountId,
            profileName: 'exp-devsecops',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: true
          ])
          withEnv([
            "AWS_CONFIG_FILE=${awsCfgDevSecops.configFile}",
            "AWS_SHARED_CREDENTIALS_FILE=${awsCfgDevSecops.credentialsFile}",
            "AWS_SDK_LOAD_CONFIG=1",
            "AWS_PROFILE=exp-devsecops"
          ]) {
            loginHelpers.dockerLogin(env.ECR)
          }
          def buildInfo = ecsDeployHelpers.getBuildInfoFromEnv(project: env.PROJECT, ecr: env.ECR)
          ecsDeployHelpers.pushImage(buildInfo)
          env.TF_VAR_app_image = buildInfo.fullImagePath
        }
      }
    }

    stage('Fetch Database Secrets') {
      steps {
        script {
          def secretName = ''
          def targetAccount = env.TARGET_ACCOUNT_DEV
          def awsProfile = 'exp-dev'

          if (env.BRANCH_NAME == 'dev') {
            secretName = 'dev/agent-service-dev'
          } else if (env.BRANCH_NAME == 'test') {
            secretName = 'dev/agent-service-test'
          } else if (env.BRANCH_NAME == 'qa') {
            secretName = 'qa/agent-service-accp'
            targetAccount = env.TARGET_ACCOUNT_QA
            awsProfile = 'exp-qa'
          } else if (env.BRANCH_NAME == 'accp') {
            secretName = 'qa/agent-service-accp'
            targetAccount = env.TARGET_ACCOUNT_QA
            awsProfile = 'exp-qa'
          } else if (env.BRANCH_NAME == 'main') {
            secretName = 'prod/agent-service-prod'
            targetAccount = env.TARGET_ACCOUNT_PROD
            awsProfile = 'exp-production'
          }

          loginHelpers.createRoleProfileConfig([
            accountId: targetAccount,
            profileName: awsProfile,
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID
          ])

          sh """
            export AWS_PROFILE=${awsProfile}
            aws secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query 'SecretString' --output text > db-secrets.json
            """

          sh 'rm -rf .aws'
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
      steps {
        script {
          def devSecOpsAccountId = '204048894727'
          loginHelpers.checkoutTerraformRepo('exp-tf-dev', 'master')
          def awsCfgDevSecops = loginHelpers.createRoleProfileConfig([
            accountId: devSecOpsAccountId,
            profileName: 'exp-devsecops',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: true
          ])
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_DEV,
            profileName: 'exp-dev',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: false
          ])
          withEnv([
            "AWS_CONFIG_FILE=${awsCfgDevSecops.configFile}",
            "AWS_SHARED_CREDENTIALS_FILE=${awsCfgDevSecops.credentialsFile}",
            "AWS_SDK_LOAD_CONFIG=1",
            "AWS_PROFILE=exp-devsecops"
          ]) {
            loginHelpers.dockerLogin(env.ECR)
          }
          def buildInfo = ecsDeployHelpers.getBuildInfoFromEnv(project: env.PROJECT, ecr: env.ECR)
          ecsDeployHelpers.runTerragruntDeploy([
            imagePath: buildInfo.fullImagePath,
            tfPath: 'account/exp-realty-dev/us-east-1/agent-service/dev/agent-service-dev/ecs',
            awsProfile: 'exp-dev'
          ])
          sh 'rm -rf .aws'
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
      steps {
        script {
          def devSecOpsAccountId = '204048894727'
          loginHelpers.checkoutTerraformRepo('exp-tf-dev', 'master')
          def awsCfgDevSecops = loginHelpers.createRoleProfileConfig([
            accountId: devSecOpsAccountId,
            profileName: 'exp-devsecops',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: true
          ])
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_DEV,
            profileName: 'exp-dev',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: false
          ])
          withEnv([
            "AWS_CONFIG_FILE=${awsCfgDevSecops.configFile}",
            "AWS_SHARED_CREDENTIALS_FILE=${awsCfgDevSecops.credentialsFile}",
            "AWS_SDK_LOAD_CONFIG=1",
            "AWS_PROFILE=exp-devsecops"
          ]) {
            loginHelpers.dockerLogin(env.ECR)
          }
          def buildInfo = ecsDeployHelpers.getBuildInfoFromEnv(project: env.PROJECT, ecr: env.ECR)
          ecsDeployHelpers.runTerragruntDeploy([
            imagePath: buildInfo.fullImagePath,
            tfPath: 'account/exp-realty-dev/us-east-1/agent-service/test/agent-service-test/ecs',
            awsProfile: 'exp-dev'
          ])
          sh 'rm -rf .aws'
        }
      }
    }

    stage('Run Migrations - Acceptance') {
      when {
        branch 'accp'
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

    stage('Deploy - Acceptance') {
      when {
        branch 'accp'
      }
      steps {
        script {
          def devSecOpsAccountId = '204048894727'
          loginHelpers.checkoutTerraformRepo('exp-tf-qa', 'master')
          def awsCfgDevSecops = loginHelpers.createRoleProfileConfig([
            accountId: devSecOpsAccountId,
            profileName: 'exp-devsecops',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: true
          ])
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_QA,
            profileName: 'exp-qa',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: false
          ])
          withEnv([
            "AWS_CONFIG_FILE=${awsCfgDevSecops.configFile}",
            "AWS_SHARED_CREDENTIALS_FILE=${awsCfgDevSecops.credentialsFile}",
            "AWS_SDK_LOAD_CONFIG=1",
            "AWS_PROFILE=exp-devsecops"
          ]) {
            loginHelpers.dockerLogin(env.ECR)
          }
          def buildInfo = ecsDeployHelpers.getBuildInfoFromEnv(project: env.PROJECT, ecr: env.ECR)
          ecsDeployHelpers.runTerragruntDeploy([
            imagePath: buildInfo.fullImagePath,
            tfPath: 'account/exp-realty-qa/us-east-1/agent-service/accp/agent-service-accp/ecs',
            awsProfile: 'exp-qa'
          ])
          sh 'rm -rf .aws'
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
      steps {
        script {
          def devSecOpsAccountId = '204048894727'
          loginHelpers.checkoutTerraformRepo('exp-tf-prod', 'master')
          def awsCfgDevSecops = loginHelpers.createRoleProfileConfig([
            accountId: devSecOpsAccountId,
            profileName: 'exp-devsecops',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: true
          ])
          loginHelpers.createRoleProfileConfig([
            accountId: env.TARGET_ACCOUNT_PROD,
            profileName: 'exp-production',
            roleName: env.ROLE_NAME,
            externalId: env.EXTERNAL_ID,
            overwriteConfig: false
          ])
          withEnv([
            "AWS_CONFIG_FILE=${awsCfgDevSecops.configFile}",
            "AWS_SHARED_CREDENTIALS_FILE=${awsCfgDevSecops.credentialsFile}",
            "AWS_SDK_LOAD_CONFIG=1",
            "AWS_PROFILE=exp-devsecops"
          ]) {
            loginHelpers.dockerLogin(env.ECR)
          }
          def buildInfo = ecsDeployHelpers.getBuildInfoFromEnv(project: env.PROJECT, ecr: env.ECR)
          ecsDeployHelpers.runTerragruntDeploy([
            imagePath: buildInfo.fullImagePath,
            tfPath: 'account/exp-realty-prod/us-east-1/agent-service/prod/agent-service-prod/ecs',
            awsProfile: 'exp-production'
          ])
          sh 'rm -rf .aws'
        }
      }
    }
  }
  environment {
    TARGET_ACCOUNT_DEV = '125434132943'
    TARGET_ACCOUNT_QA = '427827735592'
    TARGET_ACCOUNT_PROD = '704132245682'
    ROLE_NAME = 'jenkins-cross-account-role'
    EXTERNAL_ID = 'jenkins-cross-account-access'
    AWS_DEFAULT_REGION = 'us-east-1'

    PROJECT = 'exp/agent-service'
    ECR = '204048894727.dkr.ecr.us-east-1.amazonaws.com/'
    TF_LOG = 'ERROR'
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
        try {
          def buildInfo = ecsDeployHelpers.getBuildInfoFromEnv(project: env.PROJECT, ecr: env.ECR)
          sh "docker rmi ${buildInfo.fullImagePath} | true"
        } catch (Exception e) {
          // ignore when prepareBuild was not run (eg skipped stage)
        }
        sh 'rm -rf .aws'
      }
      cleanWs()
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
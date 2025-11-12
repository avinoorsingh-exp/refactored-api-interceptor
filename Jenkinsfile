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
              imageTag = "${env.PROJECT}:${env.BRANCH_NAME}-${env.VERSION}"
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
      steps {
        script {
          sh("aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR}")
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
      when {
        anyOf {
          branch 'dev'
          branch 'test'
          branch 'qa'
          branch 'accp'
          branch 'main'
        }
      }

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

          withCredentials([[
            $class: 'AmazonWebServicesCredentialsBinding',
            accessKeyVariable: 'AWS_ACCESS_KEY_ID',
            secretKeyVariable: 'AWS_SECRET_ACCESS_KEY',
            credentialsId: credentialsId
          ]]) {
            sh """
            aws secretsmanager get-secret-value --secret-id "${secretName}" --region us-east-1 --query 'SecretString' --output text > db-secrets.json
            """
          }
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
        git(url: 'https://bitbucket.org/exp-realty/exp-tf-dev.git', branch: 'master', credentialsId: 'exp-jenkins')
            withCredentials([[
              $class: 'AmazonWebServicesCredentialsBinding',
              accessKeyVariable: 'AWS_ACCESS_KEY_ID',
              secretKeyVariable: 'AWS_SECRET_ACCESS_KEY',
              credentialsId: 'Jenkins-Dev'
            ]]) {
            script
            {
              docker.image('204048894727.dkr.ecr.us-east-1.amazonaws.com/exp/jenkins-terraform')
                .inside("-u 0 -v $WORKSPACE:/data -v /var/lib/jenkins/.ssh:/data/.ssh -e BITBUCKET_USER=exp-jenkins -e AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} -e AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}")
                {
                  sh """
                  aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile exp-dev
                  aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile exp-dev
                  aws configure set region us-east-1 --profile exp-dev

                  IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                  cd account/exp-realty-dev/us-east-1/agent-service/dev/agent-service-dev/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                  terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                  """
                }
            }
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
        git(url: 'https://bitbucket.org/exp-realty/exp-tf-dev.git', branch: 'master', credentialsId: 'exp-jenkins')
            withCredentials([[
              $class: 'AmazonWebServicesCredentialsBinding',
              accessKeyVariable: 'AWS_ACCESS_KEY_ID',
              secretKeyVariable: 'AWS_SECRET_ACCESS_KEY',
              credentialsId: 'Jenkins-Dev'
            ]]) {
            script
            {
              docker.image('204048894727.dkr.ecr.us-east-1.amazonaws.com/exp/jenkins-terraform')
                .inside("-u 0 -v $WORKSPACE:/data -v /var/lib/jenkins/.ssh:/data/.ssh -e BITBUCKET_USER=exp-jenkins -e AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} -e AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}")
                {
                  sh """
                  aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile exp-dev
                  aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile exp-dev
                  aws configure set region us-east-1 --profile exp-dev

                  IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                  cd account/exp-realty-dev/us-east-1/agent-service/test/agent-service-test/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                  terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                  """
                }
            }
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
        git(url: 'https://bitbucket.org/exp-realty/exp-tf-qa.git', branch: 'master', credentialsId: 'exp-jenkins')
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          accessKeyVariable: 'AWS_ACCESS_KEY_ID',
          secretKeyVariable: 'AWS_SECRET_ACCESS_KEY',
          credentialsId: 'jenkins-qa-user'
        ]]) {
          script
          {
            docker.image('204048894727.dkr.ecr.us-east-1.amazonaws.com/exp/jenkins-terraform')
              .inside("-u 0 -v $WORKSPACE:/data -v /var/lib/jenkins/.ssh:/data/.ssh -e BITBUCKET_USER=exp-jenkins -e AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} -e AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}")
              {
                sh """
                aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile exp-qa
                aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile exp-qa
                aws configure set region us-east-1 --profile exp-qa

                IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                cd /data/account/exp-realty-qa/us-east-1/agent-service/accp/agent-service-accp/ecs
                terragrunt init -reconfigure
                terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                """
              }
          }
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
        git(url: 'https://bitbucket.org/exp-realty/exp-tf-prod.git', branch: 'master', credentialsId: 'exp-jenkins')
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          accessKeyVariable: 'AWS_ACCESS_KEY_ID',
          secretKeyVariable: 'AWS_SECRET_ACCESS_KEY',
          credentialsId: '88caba18-4691-47c5-92a9-e66ee83da4e4'
        ]]) {
          script
          {
            docker.image('204048894727.dkr.ecr.us-east-1.amazonaws.com/exp/jenkins-terraform')
              .inside("-u 0 -v $WORKSPACE:/data -v /var/lib/jenkins/.ssh:/data/.ssh -e BITBUCKET_USER=exp-jenkins -e AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} -e AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}")
              {
                sh """
                aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID --profile exp-production
                aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY --profile exp-production
                aws configure set region us-east-1 --profile exp-production

                IMAGE_TAG=\$(cat /data/image-tag.txt | tr -d '[:space:]')
                cd /data/account/exp-realty-prod/us-east-1/agent-service/prod/agent-service/ecs
                terragrunt init -reconfigure
                terragrunt plan --terragrunt-log-level trace -input=false -var "image=\$IMAGE_TAG"
                terragrunt apply -auto-approve -input=false -var "image=\$IMAGE_TAG"
                """
              }
          }
        }
      }
    }
  }
  environment {
    PROJECT = 'exp/agent-service'
    ECRURL = ''
    TF_VAR_app_image = '99'
    ECR = '204048894727.dkr.ecr.us-east-1.amazonaws.com/'
    TF_LOG = 'ERROR'
    // Job pass/fail email addresses
    RECIPIENT_LIST='''
    david.hull@exprealty.net
    '''
  }
  post {
    always {
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
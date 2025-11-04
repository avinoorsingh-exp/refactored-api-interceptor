@Library('jenkins-library') _

pipeline
{
  agent any
  stages
  {
    stage('Check if agent-service changed') {
      when {
        not { triggeredBy 'Timer' }
        not { triggeredBy 'BuildCause' } // Allow manual triggers
      }
      steps {
        script {
          // Check if any files in agent-service or shared packages changed
          def changedFiles = sh(
            script: 'git diff --name-only HEAD~1 HEAD 2>/dev/null || git diff --name-only origin/${GIT_BRANCH} 2>/dev/null || echo ""',
            returnStdout: true
          ).trim()
          
          if (!changedFiles) {
            // Try using changeset if available (webhook triggers)
            if (currentBuild.changeSets) {
              changedFiles = currentBuild.changeSets.collect { cs ->
                cs.items.collect { item ->
                  item.affectedFiles.collect { file -> file.path }
                }.flatten()
              }.flatten().join('\n')
            }
          }
          
          def relevantPaths = [
            'services/agent-service/',
            'packages/',  // Shared packages affect both services
            'package.json',
            'pnpm-lock.yaml',
            'Jenkinsfile'  // Pipeline changes
          ]
          
          def hasRelevantChanges = false
          if (changedFiles) {
            def files = changedFiles.split('\n')
            hasRelevantChanges = files.any { file ->
              relevantPaths.any { path -> file.startsWith(path) } &&
              !file.startsWith('services/orchestrator/')
            }
          }
          
          if (!hasRelevantChanges && changedFiles) {
            echo "⚠️  No agent-service changes detected. Changed files:"
            changedFiles.split('\n').each { echo "  - ${it}" }
            echo "⏭️  Skipping agent-service build (only orchestrator or unrelated files changed)"
            env.SKIP_BUILD = 'true'
            currentBuild.description = 'Skipped - no agent-service changes'
          } else {
            echo "✅ Agent-service or shared code changed. Proceeding with build."
            env.SKIP_BUILD = 'false'
          }
        }
      }
    }
    stage('Build preparations') {
      when {
        expression { env.SKIP_BUILD != 'true' }
      }
      steps {
        script {
          gitCommitHash = sh(returnStdout: true, script: 'git rev-parse HEAD').trim()
          shortCommitHash = gitCommitHash.take(7)
          // calculate a sample version tag
          VERSION = shortCommitHash
          // set the build display name
          currentBuild.displayName = "#${BUILD_ID}-${VERSION}"
          if (env.BRANCH_NAME == 'development') {
              IMAGE = "$PROJECT:dev-$VERSION" 
          } else if (env.BRANCH_NAME == 'test') {
              IMAGE = "$PROJECT:test-$VERSION" 
          } else if (env.BRANCH_NAME == 'qa') {
              IMAGE = "$PROJECT:qa-$VERSION"
          } else if (env.BRANCH_NAME == 'main') {
              IMAGE = "$PROJECT:prod-$VERSION"
          }
        }

      }
    }

    stage('Docker build') {
      when {
        expression { env.SKIP_BUILD != 'true' }
      }
      steps {
        script {
          docker.build("$IMAGE", "-f services/agent-service/Dockerfile .")
        }
      }
    }

    stage('Test + Coverage') {
      when {
        allOf {
          anyOf {
            branch 'development'
            expression { env.BRANCH_NAME.startsWith('feature/') }
          }
          expression { env.SKIP_BUILD != 'true' }
        }
      }
      steps {
        script {
          echo "🔍 DEBUG: About to call centralized coverage job"
          echo "🔍 DEBUG: Service: agent-service"
          echo "🔍 DEBUG: Branch: ${env.BRANCH_NAME}"
          
          try {
            echo "🔍 DEBUG: Calling centralized coverage job"
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
            echo "✅ DEBUG: Successfully called centralized coverage job"
          } catch (org.jenkinsci.plugins.workflow.steps.FlowInterruptedException e) {
            // FlowInterruptedException is expected when wait: false and downstream job returns UNSTABLE
            // This is not a real error - the job was triggered successfully
            echo "ℹ️  INFO: Centralized coverage job triggered (may return UNSTABLE, which is expected and non-blocking)"
          } catch (Exception e) {
            echo "❌ DEBUG: Error calling centralized coverage job: ${e.getClass().getSimpleName()}: ${e.getMessage()}"
          }
        }
      }
    }

    stage('Docker push') {
      when {
        expression { env.SKIP_BUILD != 'true' }
      }
      steps {
        script {
          sh("aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${ECR}")
          ECRURL = "http://${ECR}"
          echo ECRURL
          // Push the Docker image to ECR
          docker.withRegistry(ECRURL)
          {
            docker.image(IMAGE).push()
          }
          echo TF_VAR_app_image
          TF_VAR_app_image = "${ECR}${IMAGE}"
          echo TF_VAR_app_image
        }

      }
    }

    stage('Deploy - Development') {
      when {
        allOf {
          branch 'development'
          expression { env.SKIP_BUILD != 'true' }
        }
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

                  cd account/exp-realty-dev/us-east-1/agent-service/dev/agent-service-dev/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var 'image=${TF_VAR_app_image}'
                  terragrunt apply -auto-approve -input=false -var 'image=${TF_VAR_app_image}'
                  """
                }
            }
          }
        }
    }
    stage('Deploy - Test') {
      when {
        allOf {
          branch 'test'
          expression { env.SKIP_BUILD != 'true' }
        }
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

                  cd account/exp-realty-dev/us-east-1/agent-service/test/agent-service-test/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var 'image=${TF_VAR_app_image}'
                  terragrunt apply -auto-approve -input=false -var 'image=${TF_VAR_app_image}'
                  """
                }
            }
          }
        }
    }
    stage('Deploy - QA/Acceptance') {
      when {
        allOf {
          branch 'qa'
          expression { env.SKIP_BUILD != 'true' }
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

                  cd /data/account/exp-realty-qa/us-east-1/agent-service/accp/agent-service-accp/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var 'image=${TF_VAR_app_image}'
                  terragrunt apply -auto-approve -input=false -var 'image=${TF_VAR_app_image}'
                  """
                }
              }
            }
        }
      }
    stage('Deploy - Prod') {
      when {
        allOf {
          branch 'main'
          expression { env.SKIP_BUILD != 'true' }
        }
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

                  cd /data/account/exp-realty-prod/us-east-1/agent-service/prod/agent-service/ecs
                  terragrunt init -reconfigure
                  terragrunt plan --terragrunt-log-level trace -input=false -var 'image=${TF_VAR_app_image}'
                  terragrunt apply -auto-approve -input=false -var 'image=${TF_VAR_app_image}'
                  """
                }
          }
      }
    }
  }
  }
  environment {
    VERSION = 'latest'
    PROJECT = 'exp/agent-service'
    IMAGE = 'exp/agent-service:latest'
    ECRURL = ''
    TF_VAR_app_image = '99'
    ECR = '204048894727.dkr.ecr.us-east-1.amazonaws.com/'
    TF_LOG = 'ERROR'
    SKIP_BUILD = 'false'  // Default to false (build by default)
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
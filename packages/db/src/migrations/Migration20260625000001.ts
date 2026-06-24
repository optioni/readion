import { randomUUID } from 'node:crypto'
import { Migration } from '@mikro-orm/migrations'

const SEED_VERIFIED_AT = '2026-06-24T00:00:00.000Z'
const SEED_CREATED_AT = '2026-06-24T00:00:00.000Z'

interface SeedRow {
  code: string
  name: string
  provider: string
  domains: { name: string; weight: number }[]
  questionCount: number
  passingScore: number
  timeLimitMinutes: number
}

const SEED_ROWS: SeedRow[] = [
  // AWS
  {
    code: 'CLF-C02',
    name: 'AWS Cloud Practitioner',
    provider: 'AWS',
    domains: [
      { name: 'Cloud Concepts', weight: 24 },
      { name: 'Security and Compliance', weight: 30 },
      { name: 'Cloud Technology and Services', weight: 34 },
      { name: 'Billing, Pricing, and Support', weight: 12 },
    ],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
  },
  {
    code: 'SAA-C03',
    name: 'AWS Solutions Architect Associate',
    provider: 'AWS',
    domains: [
      { name: 'Design Secure Architectures', weight: 30 },
      { name: 'Design Resilient Architectures', weight: 26 },
      { name: 'Design High-Performing Architectures', weight: 24 },
      { name: 'Design Cost-Optimized Architectures', weight: 20 },
    ],
    questionCount: 65,
    passingScore: 720,
    timeLimitMinutes: 130,
  },
  {
    code: 'DVA-C02',
    name: 'AWS Developer Associate',
    provider: 'AWS',
    domains: [
      { name: 'Development with AWS Services', weight: 32 },
      { name: 'Security', weight: 26 },
      { name: 'Deployment', weight: 24 },
      { name: 'Troubleshooting and Optimization', weight: 18 },
    ],
    questionCount: 65,
    passingScore: 720,
    timeLimitMinutes: 130,
  },
  {
    code: 'SOA-C02',
    name: 'AWS SysOps Administrator Associate',
    provider: 'AWS',
    domains: [
      { name: 'Monitoring, Logging, and Remediation', weight: 20 },
      { name: 'Reliability and Business Continuity', weight: 16 },
      { name: 'Deployment, Provisioning, and Automation', weight: 18 },
      { name: 'Security and Compliance', weight: 16 },
      { name: 'Networking and Content Delivery', weight: 18 },
      { name: 'Cost and Performance Optimization', weight: 12 },
    ],
    questionCount: 65,
    passingScore: 720,
    timeLimitMinutes: 180,
  },
  {
    code: 'DOP-C02',
    name: 'AWS DevOps Engineer Professional',
    provider: 'AWS',
    domains: [
      { name: 'SDLC Automation', weight: 22 },
      { name: 'Configuration Management and Infrastructure as Code', weight: 17 },
      { name: 'Resilient Cloud Solutions', weight: 15 },
      { name: 'Monitoring and Logging', weight: 15 },
      { name: 'Incident and Event Response', weight: 14 },
      { name: 'Security and Compliance', weight: 17 },
    ],
    questionCount: 75,
    passingScore: 750,
    timeLimitMinutes: 180,
  },
  {
    code: 'SAP-C02',
    name: 'AWS Solutions Architect Professional',
    provider: 'AWS',
    domains: [
      { name: 'Design Solutions for Organizational Complexity', weight: 26 },
      { name: 'Design for New Solutions', weight: 29 },
      { name: 'Continuous Improvement for Existing Solutions', weight: 25 },
      { name: 'Accelerate Workload Migration and Modernization', weight: 20 },
    ],
    questionCount: 75,
    passingScore: 750,
    timeLimitMinutes: 180,
  },
  {
    code: 'AIF-C01',
    name: 'AWS AI Practitioner',
    provider: 'AWS',
    domains: [
      { name: 'Fundamentals of AI and ML', weight: 20 },
      { name: 'Fundamentals of Generative AI', weight: 24 },
      { name: 'Applications of Foundation Models', weight: 28 },
      { name: 'Guidelines for Responsible AI', weight: 14 },
      { name: 'Security, Compliance, and Governance for AI Solutions', weight: 14 },
    ],
    questionCount: 65,
    passingScore: 700,
    timeLimitMinutes: 90,
  },
  {
    code: 'MLA-C01',
    name: 'AWS Machine Learning Engineer Associate',
    provider: 'AWS',
    domains: [
      { name: 'Data Preparation for Machine Learning', weight: 28 },
      { name: 'ML Model Development', weight: 26 },
      { name: 'Deployment and Orchestration of ML Workflows', weight: 22 },
      { name: 'ML Solution Monitoring, Maintenance, and Security', weight: 24 },
    ],
    questionCount: 65,
    passingScore: 720,
    timeLimitMinutes: 130,
  },
  {
    code: 'MLS-C01',
    name: 'AWS Machine Learning Specialty',
    provider: 'AWS',
    domains: [
      { name: 'Data Engineering', weight: 20 },
      { name: 'Exploratory Data Analysis', weight: 24 },
      { name: 'Modeling', weight: 36 },
      { name: 'Machine Learning Implementation and Operations', weight: 20 },
    ],
    questionCount: 65,
    passingScore: 750,
    timeLimitMinutes: 180,
  },
  // Azure
  {
    code: 'AZ-900',
    name: 'Microsoft Azure Fundamentals',
    provider: 'Azure',
    domains: [
      { name: 'Describe cloud concepts', weight: 25 },
      { name: 'Describe Azure architecture and services', weight: 40 },
      { name: 'Describe Azure management and governance', weight: 35 },
    ],
    questionCount: 45,
    passingScore: 700,
    timeLimitMinutes: 45,
  },
  {
    code: 'AZ-104',
    name: 'Microsoft Azure Administrator',
    provider: 'Azure',
    domains: [
      { name: 'Manage Azure identities and governance', weight: 20 },
      { name: 'Implement and manage storage', weight: 15 },
      { name: 'Deploy and manage Azure compute resources', weight: 20 },
      { name: 'Implement and manage virtual networking', weight: 25 },
      { name: 'Monitor and maintain Azure resources', weight: 20 },
    ],
    questionCount: 60,
    passingScore: 700,
    timeLimitMinutes: 120,
  },
  {
    code: 'AZ-204',
    name: 'Developing Solutions for Microsoft Azure',
    provider: 'Azure',
    domains: [
      { name: 'Develop Azure compute solutions', weight: 25 },
      { name: 'Develop for Azure storage', weight: 15 },
      { name: 'Implement Azure security', weight: 20 },
      { name: 'Monitor, troubleshoot, and optimize Azure solutions', weight: 15 },
      { name: 'Connect to and consume Azure services and third-party services', weight: 25 },
    ],
    questionCount: 60,
    passingScore: 700,
    timeLimitMinutes: 120,
  },
  {
    code: 'AZ-305',
    name: 'Designing Microsoft Azure Infrastructure Solutions',
    provider: 'Azure',
    domains: [
      { name: 'Design identity, governance, and monitoring solutions', weight: 25 },
      { name: 'Design data storage solutions', weight: 25 },
      { name: 'Design business continuity solutions', weight: 15 },
      { name: 'Design infrastructure solutions', weight: 35 },
    ],
    questionCount: 60,
    passingScore: 700,
    timeLimitMinutes: 120,
  },
  {
    code: 'AZ-400',
    name: 'Designing and Implementing Microsoft DevOps Solutions',
    provider: 'Azure',
    domains: [
      { name: 'Configure processes and communications', weight: 10 },
      { name: 'Design and implement source control', weight: 15 },
      { name: 'Design and implement build and release pipelines', weight: 40 },
      { name: 'Develop a security and compliance plan', weight: 20 },
      { name: 'Implement an instrumentation strategy', weight: 15 },
    ],
    questionCount: 60,
    passingScore: 700,
    timeLimitMinutes: 150,
  },
  {
    code: 'AI-900',
    name: 'Microsoft Azure AI Fundamentals',
    provider: 'Azure',
    domains: [
      { name: 'Describe Artificial Intelligence workloads and considerations', weight: 20 },
      { name: 'Describe fundamental principles of machine learning on Azure', weight: 25 },
      { name: 'Describe features of computer vision workloads on Azure', weight: 15 },
      { name: 'Describe features of Natural Language Processing workloads on Azure', weight: 25 },
      { name: 'Describe features of generative AI workloads on Azure', weight: 15 },
    ],
    questionCount: 45,
    passingScore: 700,
    timeLimitMinutes: 45,
  },
  {
    code: 'AI-102',
    name: 'Designing and Implementing a Microsoft Azure AI Solution',
    provider: 'Azure',
    domains: [
      { name: 'Plan and manage an Azure AI solution', weight: 15 },
      { name: 'Implement decision support solutions', weight: 10 },
      { name: 'Implement computer vision solutions', weight: 15 },
      { name: 'Implement natural language processing solutions', weight: 30 },
      { name: 'Implement knowledge mining and document intelligence solutions', weight: 15 },
      { name: 'Implement generative AI solutions', weight: 15 },
    ],
    questionCount: 60,
    passingScore: 700,
    timeLimitMinutes: 120,
  },
  {
    code: 'DP-100',
    name: 'Designing and Implementing a Data Science Solution on Azure',
    provider: 'Azure',
    domains: [
      { name: 'Design and prepare a machine learning solution', weight: 20 },
      { name: 'Explore data and train models', weight: 35 },
      { name: 'Prepare a model for deployment', weight: 20 },
      { name: 'Deploy and retrain a model', weight: 25 },
    ],
    questionCount: 60,
    passingScore: 700,
    timeLimitMinutes: 120,
  },
  // Kubernetes
  {
    code: 'CKA',
    name: 'Certified Kubernetes Administrator',
    provider: 'CNCF',
    domains: [
      { name: 'Cluster Architecture, Installation & Configuration', weight: 25 },
      { name: 'Workloads & Scheduling', weight: 15 },
      { name: 'Services & Networking', weight: 20 },
      { name: 'Storage', weight: 10 },
      { name: 'Troubleshooting', weight: 30 },
    ],
    questionCount: 17,
    passingScore: 66,
    timeLimitMinutes: 120,
  },
  {
    code: 'CKAD',
    name: 'Certified Kubernetes Application Developer',
    provider: 'CNCF',
    domains: [
      { name: 'Application Design and Build', weight: 20 },
      { name: 'Application Deployment', weight: 20 },
      { name: 'Application Observability and Maintenance', weight: 15 },
      { name: 'Application Environment, Configuration and Security', weight: 25 },
      { name: 'Services and Networking', weight: 20 },
    ],
    questionCount: 17,
    passingScore: 66,
    timeLimitMinutes: 120,
  },
  {
    code: 'CKS',
    name: 'Certified Kubernetes Security Specialist',
    provider: 'CNCF',
    domains: [
      { name: 'Cluster Setup', weight: 10 },
      { name: 'Cluster Hardening', weight: 15 },
      { name: 'System Hardening', weight: 15 },
      { name: 'Minimize Microservice Vulnerabilities', weight: 20 },
      { name: 'Supply Chain Security', weight: 20 },
      { name: 'Monitoring, Logging and Runtime Security', weight: 20 },
    ],
    questionCount: 16,
    passingScore: 67,
    timeLimitMinutes: 120,
  },
  // AI/ML vendor-neutral
  {
    code: 'TF-DevCert',
    name: 'TensorFlow Developer Certificate',
    provider: 'Google',
    domains: [
      { name: 'Building and Training Neural Networks in TensorFlow', weight: 25 },
      { name: 'Image Classification', weight: 25 },
      { name: 'Natural Language Processing', weight: 25 },
      { name: 'Time Series, Sequences and Predictions', weight: 25 },
    ],
    questionCount: 5,
    passingScore: 90,
    timeLimitMinutes: 300,
  },
  {
    code: 'Databricks-MLA',
    name: 'Databricks Certified Machine Learning Associate',
    provider: 'Databricks',
    domains: [
      { name: 'Machine Learning with Databricks', weight: 19 },
      { name: 'Experiment Tracking', weight: 9 },
      { name: 'Machine Learning Modeling', weight: 38 },
      { name: 'ML Pipelines and Workflows', weight: 19 },
      { name: 'Model Lifecycle Management', weight: 15 },
    ],
    questionCount: 60,
    passingScore: 70,
    timeLimitMinutes: 120,
  },
  {
    code: 'GCP-MLE',
    name: 'Google Cloud Professional Machine Learning Engineer',
    provider: 'Google Cloud',
    domains: [
      { name: 'Architecting low-code ML solutions', weight: 12 },
      { name: 'Collaborating within and across teams to manage data and models', weight: 16 },
      { name: 'Scaling prototypes into ML models', weight: 14 },
      { name: 'Serving and scaling models', weight: 14 },
      { name: 'Automating and orchestrating ML pipelines', weight: 18 },
      { name: 'Monitoring ML solutions', weight: 14 },
      { name: 'Managing ML solution quality', weight: 12 },
    ],
    questionCount: 60,
    passingScore: 70,
    timeLimitMinutes: 120,
  },
  {
    code: 'HF-NLP',
    name: 'Hugging Face NLP with Transformers',
    provider: 'Hugging Face',
    domains: [
      { name: 'Tokenization and Datasets', weight: 25 },
      { name: 'Models and Pretraining', weight: 25 },
      { name: 'Fine-tuning Models', weight: 25 },
      { name: 'Sharing and Deploying Models', weight: 25 },
    ],
    questionCount: 20,
    passingScore: 80,
    timeLimitMinutes: 60,
  },
]

function esc(s: string) {
  return s.replace(/'/g, "''")
}

export class Migration20260625000001 extends Migration {
  override async up(): Promise<void> {
    for (const row of SEED_ROWS) {
      const id = randomUUID()
      const domains = JSON.stringify(row.domains).replace(/'/g, "''")

      this.addSql(`
        INSERT INTO certifications (
          id, name, provider, code, domains,
          question_count, passing_score, time_limit_minutes,
          state, provenance, verified_at, created_at, updated_at
        ) VALUES (
          '${id}',
          '${esc(row.name)}',
          '${esc(row.provider)}',
          '${esc(row.code)}',
          '${domains}'::jsonb,
          ${row.questionCount},
          ${row.passingScore},
          ${row.timeLimitMinutes},
          'draft',
          '"verified"'::jsonb,
          '${SEED_VERIFIED_AT}',
          '${SEED_CREATED_AT}',
          '${SEED_CREATED_AT}'
        )
        ON CONFLICT (code) DO NOTHING
      `)
    }
  }

  override async down(): Promise<void> {
    const codes = SEED_ROWS.map((r) => `'${r.code}'`).join(', ')
    this.addSql(`DELETE FROM certifications WHERE code IN (${codes})`)
  }
}

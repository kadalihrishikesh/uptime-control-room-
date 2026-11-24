# Terraform infrastructure

This folder adopts and manages the existing private S3 audit-log bucket, then
creates a small public VPC and EC2 deployment for the Docker app.

## Before running Terraform

Terraform needs separate AWS credentials with infrastructure permissions. Do not use the application's `uptime-control-room-local-logger` IAM user: it is intentionally restricted to writing application logs to S3.

## Adopt the existing bucket

1. Copy the example variables file:

   ```powershell
   Copy-Item terraform.tfvars.example terraform.tfvars
   ```

2. Put the new bucket's exact name and region into `terraform.tfvars`.
3. Load your Terraform deployment credentials into the current PowerShell session.
4. Run:

   ```powershell
   terraform init
   terraform import aws_s3_bucket.uptime_logs YOUR-BUCKET-NAME
   terraform plan
   ```

Do not run `terraform apply` until the plan has been reviewed. The initial module enables S3 public-access blocking, SSE-S3 default encryption, and bucket versioning.

## EC2 deployment

Set `docker_image` in `terraform.tfvars` to the exact public Docker Hub image
that contains this application. The EC2 instance starts that image on port 80.
It receives an IAM role that can upload only check logs to the S3 prefix. It
does not receive static AWS access keys.

After reviewing the plan, run:

```powershell
terraform apply
terraform output application_url
```

The instance uses AWS Systems Manager (SSM), so no inbound SSH port is opened.

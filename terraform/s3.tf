# This resource represents the bucket you already created manually. Import it
# before applying so Terraform adopts it instead of creating a second bucket.
resource "aws_s3_bucket" "uptime_logs" {
  bucket = var.log_bucket_name
}

resource "aws_s3_bucket_public_access_block" "uptime_logs" {
  bucket = aws_s3_bucket.uptime_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uptime_logs" {
  bucket = aws_s3_bucket.uptime_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "uptime_logs" {
  bucket = aws_s3_bucket.uptime_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}

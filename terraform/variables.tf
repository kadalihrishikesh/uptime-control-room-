variable "aws_region" {
  description = "AWS region containing the existing S3 log bucket."
  type        = string
  default     = "eu-west-2"
}

variable "log_bucket_name" {
  description = "Exact name of the existing private S3 bucket used for uptime check logs."
  type        = string
}

variable "docker_image" {
  description = "Public Docker image, including a tag, for the EC2 instance to run."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance size for the application server."
  type        = string
  default     = "t3.micro"
}

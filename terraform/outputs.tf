output "application_url" {
  description = "Public URL for the Uptime Control Room EC2 deployment."
  value       = "http://${aws_instance.app.public_dns}"
}

output "ec2_instance_id" {
  description = "Set this as the EC2_INSTANCE_ID GitHub Actions secret for deployments."
  value       = aws_instance.app.id
}

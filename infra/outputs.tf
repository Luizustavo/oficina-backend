output "k3s_instance_public_ip" {
  description = "Static (Elastic) IP of the k3s node — the app is reachable at http://<this-ip>:<k3s_node_port>"
  value       = aws_eip.k3s_node.public_ip
}

output "connect_via_ssm" {
  description = "Open a shell on the node without SSH keys"
  value       = "aws ssm start-session --target ${aws_instance.k3s_node.id} --region ${var.aws_region} --profile ${var.aws_profile}"
}

output "app_url" {
  description = "Public URL of the app once the Deployment/Service are applied"
  value       = "http://${aws_eip.k3s_node.public_ip}:${var.k3s_node_port}"
}

output "ecr_repository_url" {
  description = "Push Docker images here; referenced by the K8s Deployment manifest"
  value       = aws_ecr_repository.app.repository_url
}

output "rds_endpoint" {
  description = "RDS host:port, without credentials"
  value       = aws_db_instance.main.endpoint
}

output "database_url" {
  description = "Full DATABASE_URL for the app's Secret — feed this into k8s/secret.yaml, never commit it"
  value       = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.main.address}:5432/${var.db_name}?sslmode=no-verify"
  sensitive   = true
}

output "aws_account_id" {
  description = "Account ID, useful for building the ECR image URI"
  value       = data.aws_caller_identity.current.account_id
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "db_endpoint" {
  description = "Endpoint of the RDS PostgreSQL instance"
  value       = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  description = "Endpoint of the ElastiCache Redis cluster"
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "assets_bucket" {
  description = "Name of the S3 bucket for long-term assets"
  value       = aws_s3_bucket.assets.id
}

output "workspace_bucket" {
  description = "Name of the S3 bucket for ephemeral worker workspaces"
  value       = aws_s3_bucket.workspace.id
}

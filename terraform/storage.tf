resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "assets" {
  bucket = "${var.app_name}-${var.environment}-assets-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "assets_block" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket" "workspace" {
  bucket = "${var.app_name}-${var.environment}-workspace-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_public_access_block" "workspace_block" {
  bucket = aws_s3_bucket.workspace.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "workspace_lifecycle" {
  bucket = aws_s3_bucket.workspace.id

  rule {
    id     = "expire_old_workspaces"
    status = "Enabled"

    expiration {
      days = 7
    }
  }
}

# IAM Policy for ECS Tasks to access S3
resource "aws_iam_policy" "ecs_s3_access" {
  name        = "${var.app_name}-${var.environment}-ecs-s3-policy"
  description = "Allows ECS tasks to read/write to AutoTube S3 buckets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.assets.arn,
          "${aws_s3_bucket.assets.arn}/*",
          aws_s3_bucket.workspace.arn,
          "${aws_s3_bucket.workspace.arn}/*"
        ]
      }
    ]
  })
}

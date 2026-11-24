data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ec2" {
  name               = "uptime-control-room-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "ec2_s3_logs" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.uptime_logs.arn}/uptime-checks/*"]
  }
}

resource "aws_iam_role_policy" "ec2_s3_logs" {
  name   = "write-uptime-check-logs"
  role   = aws_iam_role.ec2.id
  policy = data.aws_iam_policy_document.ec2_s3_logs.json
}

resource "aws_iam_instance_profile" "ec2" {
  name = "uptime-control-room-ec2"
  role = aws_iam_role.ec2.name
}

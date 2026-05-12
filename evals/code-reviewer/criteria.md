# Code Reviewer Evaluation Criteria

### Detection Rate
Did the reviewer find the known issues embedded in the code? Each test case has a list of expected issues. The reviewer should identify all of them.
Threshold: 7

### False Positive Rate
Did the reviewer flag things that are not real issues? A high-quality review avoids noise. Score 10 if no false positives, lower for each incorrect flag.
Threshold: 8

### Actionability
Are the reviewer's suggestions specific and actionable? Each finding should include a concrete fix, not just a vague warning. Score based on how easily a developer could resolve each finding from the review alone.
Threshold: 7

### Severity Accuracy
Are the severity levels correct? A SQL injection should be CRITICAL, not INFO. A minor naming suggestion should be INFO, not WARNING. Score based on how well the assigned severities match the actual risk.
Threshold: 7

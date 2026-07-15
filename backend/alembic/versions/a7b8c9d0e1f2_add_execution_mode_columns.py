"""add execution mode columns

Revision ID: a7b8c9d0e1f2
Revises: d93039c09397
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('executions', sa.Column('mode', sa.String(), server_default='upscale', nullable=False))
    op.add_column('executions', sa.Column('target_width', sa.Integer(), nullable=True))
    op.add_column('executions', sa.Column('target_height', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('executions', 'target_height')
    op.drop_column('executions', 'target_width')
    op.drop_column('executions', 'mode')
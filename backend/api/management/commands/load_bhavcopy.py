"""
Django management command to load NSE Bhavcopy CSVs into MySQL (Task 4).
Maps exchange columns, filters for equity series ('EQ', 'BE', 'BZ'),
and performs bulk insertion with conflict resolution.
"""
import csv
import glob
import os
from decimal import Decimal, InvalidOperation
from django.conf import settings
from django.core.management.base import BaseCommand
from api.models import Bhavcopy


class Command(BaseCommand):
    help = 'Loads NSE Bhavcopy CSV files into the Bhavcopy model.'

    def add_arguments(self, parser):
        parser.add_argument(
            'directory',
            nargs='?',
            type=str,
            default=None,
            help='Directory containing BhavCopy_NSE_CM_*.csv files. Defaults to data/ or ARIA_DATA_DIR.',
        )

    def handle(self, *args, **options):
        directory = options.get('directory')
        if not directory:
            directory = os.environ.get('ARIA_DATA_DIR')
        if not directory or not os.path.exists(directory):
            directory = str(settings.BASE_DIR.parent / 'data')
            if not os.path.exists(directory):
                directory = str(settings.BASE_DIR / 'data')

        self.stdout.write(f'Scanning for Bhavcopy files in: {directory}')
        pattern = os.path.join(directory, 'BhavCopy_NSE_CM_*.csv')
        csv_files = sorted(glob.glob(pattern))

        if not csv_files:
            # Also check subdirectories or case-insensitive variations
            pattern_sub = os.path.join(directory, '**', 'BhavCopy_NSE_CM_*.csv')
            csv_files = sorted(glob.glob(pattern_sub, recursive=True))

        if not csv_files:
            self.stdout.write(self.style.WARNING(f'No Bhavcopy CSV files found matching {pattern}'))
            return

        self.stdout.write(f'Found {len(csv_files)} Bhavcopy CSV file(s).')
        valid_series = {'EQ', 'BE', 'BZ'}
        total_inserted = 0

        for csv_path in csv_files:
            file_name = os.path.basename(csv_path)
            self.stdout.write(f'Parsing {file_name}...')
            batch = []
            file_count = 0

            with open(csv_path, mode='r', encoding='utf-8', errors='ignore') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    scty_srs = (row.get('SctySrs') or '').strip().upper()
                    if scty_srs not in valid_series:
                        continue

                    trad_dt = row.get('TradDt')
                    tckr_symb = (row.get('TckrSymb') or '').strip().upper()
                    if not trad_dt or not tckr_symb:
                        continue

                    try:
                        cls_pric = Decimal(row.get('ClsPric', '0'))
                        prvs_clsg_pric = Decimal(row.get('PrvsClsgPric', '0'))
                    except (InvalidOperation, TypeError):
                        continue

                    try:
                        ttl_tradg_vol = int(row.get('TtlTradgVol', 0))
                    except (ValueError, TypeError):
                        ttl_tradg_vol = 0

                    ttl_trf_val = None
                    val_str = row.get('TtlTrfVal')
                    if val_str:
                        try:
                            ttl_trf_val = Decimal(val_str)
                        except (InvalidOperation, TypeError):
                            ttl_trf_val = None

                    fin_instrm_nm = (row.get('FinInstrmNm') or '').strip()[:255]

                    record = Bhavcopy(
                        trad_dt=trad_dt,
                        tckr_symb=tckr_symb,
                        isin=(row.get('ISIN') or '').strip(),
                        fin_instrm_nm=fin_instrm_nm,
                        cls_pric=cls_pric,
                        prvs_clsg_pric=prvs_clsg_pric,
                        ttl_tradg_vol=ttl_tradg_vol,
                        ttl_trf_val=ttl_trf_val,
                        scty_srs=scty_srs,
                    )
                    batch.append(record)

                    if len(batch) >= 500:
                        Bhavcopy.objects.bulk_create(batch, batch_size=500, ignore_conflicts=True)
                        file_count += len(batch)
                        total_inserted += len(batch)
                        batch = []

            if batch:
                Bhavcopy.objects.bulk_create(batch, batch_size=500, ignore_conflicts=True)
                file_count += len(batch)
                total_inserted += len(batch)

            self.stdout.write(f'  Finished {file_name}: {file_count} equity rows processed.')

        total_in_db = Bhavcopy.objects.count()
        self.stdout.write(self.style.SUCCESS(f'Successfully loaded Bhavcopy data. Total records in database: {total_in_db}'))

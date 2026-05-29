/**
 * Copyright since 2025 Mifos Initiative
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  MatCell,
  MatCellDef,
  MatColumnDef,
  MatFooterCell,
  MatFooterCellDef,
  MatFooterRow,
  MatFooterRowDef,
  MatHeaderCell,
  MatHeaderCellDef,
  MatHeaderRow,
  MatHeaderRowDef,
  MatRow,
  MatRowDef,
  MatTable,
  MatTableDataSource
} from '@angular/material/table';
import { Dates } from 'app/core/utils/dates';
import {
  Payment,
  ProjectedAmortizationSchedule
} from 'app/loans/models/working-capital/working-capital-loan-account.model';
import { DateFormatPipe } from 'app/pipes/date-format.pipe';
import { FormatNumberPipe } from 'app/pipes/format-number.pipe';
import { SettingsService } from 'app/settings/settings.service';
import { STANDALONE_SHARED_IMPORTS } from 'app/standalone-shared.module';
import { TranslateService } from '@ngx-translate/core';
import { jsPDF, jsPDFOptions } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'mifosx-loan-amortization-schedule-tab',
  templateUrl: './loan-amortization-schedule-tab.component.html',
  styleUrl: './loan-amortization-schedule-tab.component.scss',
  imports: [
    ...STANDALONE_SHARED_IMPORTS,
    FaIconComponent,
    CurrencyPipe,
    MatTable,
    MatColumnDef,
    MatHeaderCellDef,
    MatHeaderCell,
    MatCellDef,
    MatCell,
    MatFooterCellDef,
    MatFooterCell,
    MatHeaderRowDef,
    MatHeaderRow,
    MatRowDef,
    MatRow,
    MatFooterRowDef,
    MatFooterRow,
    DateFormatPipe,
    FormatNumberPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoanAmortizationScheduleTabComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private settingsService = inject(SettingsService);
  private dateUtils = inject(Dates);
  private translateService = inject(TranslateService);

  amortizationSchedule: ProjectedAmortizationSchedule | null = null;
  dataSource = new MatTableDataSource<Payment>();
  currencyCode: string = '';

  private readonly baseColumns: string[] = [
    'number',
    'paymentDate',
    'expectedPaymentAmount',
    'expectedBalance',
    'expectedAmortizationAmount',
    'expectedDiscountFeeBalance'
  ];

  private readonly optionalColumns: { field: keyof Payment; column: string }[] = [
    { field: 'actualPaymentAmount', column: 'actualPaymentAmount' },
    { field: 'actualBalance', column: 'actualBalance' },
    { field: 'actualAmortizationAmount', column: 'actualAmortizationAmount' },
    { field: 'actualDiscountFeeBalance', column: 'actualDiscountFeeBalance' }
  ];

  displayedColumns: string[] = [...this.baseColumns];

  private readonly columnLabelKeys: Record<string, string> = {
    number: '#',
    paymentDate: 'labels.inputs.Payment Date',
    expectedPaymentAmount: 'labels.inputs.Expected Payment Amount',
    expectedBalance: 'labels.inputs.Expected Balance',
    expectedAmortizationAmount: 'labels.inputs.Expected Amortization Amount',
    expectedDiscountFeeBalance: 'labels.inputs.Expected Discount Fee Balance',
    actualPaymentAmount: 'labels.inputs.Actual Payment',
    actualBalance: 'labels.inputs.Actual Balance',
    actualAmortizationAmount: 'labels.inputs.Actual Amortization',
    actualDiscountFeeBalance: 'labels.inputs.Actual Discount Fee Balance'
  };

  ngOnInit(): void {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data: { amortizationSchedule: ProjectedAmortizationSchedule }) => {
        this.amortizationSchedule = data.amortizationSchedule;
        this.dataSource.data = data.amortizationSchedule?.payments ?? [];
        this.buildDisplayedColumns();
      });

    if (this.route.parent) {
      this.route.parent.data
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((data: { loanDetailsData: { currency?: { code: string } } }) => {
          if (data?.loanDetailsData?.currency?.code) {
            this.currencyCode = data.loanDetailsData.currency.code;
          }
        });
    }
  }

  private buildDisplayedColumns(): void {
    const columns = [...this.baseColumns];
    const payments = this.amortizationSchedule?.payments ?? [];
    for (const { field, column } of this.optionalColumns) {
      if (payments.some((p) => p[field] != null)) {
        columns.push(column);
      }
    }
    this.displayedColumns = columns;
  }

  exportToPDF(): void {
    const businessDate = this.dateUtils.formatDate(this.settingsService.businessDate, Dates.DEFAULT_DATEFORMAT);
    const fileName = `amortization-schedule-${businessDate}.pdf`;

    const options: jsPDFOptions = {
      orientation: 'l',
      unit: 'in',
      format: 'letter',
      precision: 2,
      compress: true,
      putOnlyUsedFonts: true
    };
    const pdf = new jsPDF(options);

    const columns = this.displayedColumns.map((col) => ({
      header: this.translateService.instant(this.columnLabelKeys[col] ?? col),
      dataKey: col
    }));

    const body = this.dataSource.data.map((payment) => {
      const row: Record<string, string | number> = {};
      for (const col of this.displayedColumns) {
        row[col] = this.getPaymentValue(payment, col);
      }
      return row;
    });

    autoTable(pdf, {
      columns,
      body,
      bodyStyles: { lineColor: [
          0,
          0,
          0
        ] },
      styles: { fontSize: 8, cellWidth: 'auto', halign: 'center' }
    });
    pdf.save(fileName);
  }

  private getPaymentValue(payment: Payment, column: string): string | number {
    const fmt = (v: number | undefined) =>
      v != null ? v.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : '';
    switch (column) {
      case 'number':
        return payment.paymentNo;
      case 'paymentDate':
        return payment.paymentDate ? this.dateUtils.formatDate(payment.paymentDate, Dates.DEFAULT_DATEFORMAT) : '';
      case 'expectedPaymentAmount':
        return fmt(payment.expectedPaymentAmount);
      case 'expectedBalance':
        return fmt(payment.expectedBalance);
      case 'actualBalance':
        return fmt(payment.actualBalance);
      case 'expectedAmortizationAmount':
        return fmt(payment.expectedAmortizationAmount);
      case 'actualPaymentAmount':
        return fmt(payment.actualPaymentAmount);
      case 'actualAmortizationAmount':
        return fmt(payment.actualAmortizationAmount);
      case 'expectedDiscountFeeBalance':
        return fmt(payment.expectedDiscountFeeBalance);
      case 'actualDiscountFeeBalance':
        return fmt(payment.actualDiscountFeeBalance);
      default:
        return '';
    }
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          hr_variables: Json | null
          id: string
          month_values: Json
          paye_tax_variables: Json
          payroll_variables: Json
          super_admin_created: boolean
          super_admin_signup_enabled: boolean
          updated_at: string
        }
        Insert: {
          hr_variables?: Json | null
          id?: string
          month_values?: Json
          paye_tax_variables?: Json
          payroll_variables?: Json
          super_admin_created?: boolean
          super_admin_signup_enabled?: boolean
          updated_at?: string
        }
        Update: {
          hr_variables?: Json | null
          id?: string
          month_values?: Json
          paye_tax_variables?: Json
          payroll_variables?: Json
          super_admin_created?: boolean
          super_admin_signup_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          absent_status: string
          created_at: string
          date: string
          day: string
          day_client: string
          day_site: string
          day_wk: number
          day2: number
          dow: number
          id: string
          is_present: string
          mth: number
          ndw: string
          night: string
          night_client: string
          night_site: string
          night_wk: number
          ot: number
          ot_site: string
          overtime_details: string
          position: string
          staff_id: string
          staff_name: string
        }
        Insert: {
          absent_status?: string
          created_at?: string
          date: string
          day?: string
          day_client?: string
          day_site?: string
          day_wk?: number
          day2?: number
          dow?: number
          id?: string
          is_present?: string
          mth?: number
          ndw?: string
          night?: string
          night_client?: string
          night_site?: string
          night_wk?: number
          ot?: number
          ot_site?: string
          overtime_details?: string
          position?: string
          staff_id: string
          staff_name?: string
        }
        Update: {
          absent_status?: string
          created_at?: string
          date?: string
          day?: string
          day_client?: string
          day_site?: string
          day_wk?: number
          day2?: number
          dow?: number
          id?: string
          is_present?: string
          mth?: number
          ndw?: string
          night?: string
          night_client?: string
          night_site?: string
          night_wk?: number
          ot?: number
          ot_site?: string
          overtime_details?: string
          position?: string
          staff_id?: string
          staff_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      department_tasks: {
        Row: {
          created_at: string
          department: string
          id: string
          offboarding_tasks: Json
          onboarding_tasks: Json
        }
        Insert: {
          created_at?: string
          department: string
          id?: string
          offboarding_tasks?: Json
          onboarding_tasks?: Json
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          offboarding_tasks?: Json
          onboarding_tasks?: Json
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      disciplinary_records: {
        Row: {
          acknowledged: boolean | null
          action_taken: string | null
          attachments: Json | null
          committee_meeting_date: string | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          employee_comment: string | null
          employee_id: string | null
          final_result: string | null
          id: string
          initial_result: string | null
          query_deadline: string | null
          query_issued: boolean | null
          query_replied: boolean | null
          query_reply_text: string | null
          reported_by: string | null
          severity: string
          status: string | null
          suspension_end_date: string | null
          suspension_start_date: string | null
          type: string
          updated_at: string | null
          visible_to_employee: boolean | null
          workflow_state: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          action_taken?: string | null
          attachments?: Json | null
          committee_meeting_date?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          employee_comment?: string | null
          employee_id?: string | null
          final_result?: string | null
          id: string
          initial_result?: string | null
          query_deadline?: string | null
          query_issued?: boolean | null
          query_replied?: boolean | null
          query_reply_text?: string | null
          reported_by?: string | null
          severity: string
          status?: string | null
          suspension_end_date?: string | null
          suspension_start_date?: string | null
          type: string
          updated_at?: string | null
          visible_to_employee?: boolean | null
          workflow_state?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          action_taken?: string | null
          attachments?: Json | null
          committee_meeting_date?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          employee_comment?: string | null
          employee_id?: string | null
          final_result?: string | null
          id?: string
          initial_result?: string | null
          query_deadline?: string | null
          query_issued?: boolean | null
          query_replied?: boolean | null
          query_reply_text?: string | null
          reported_by?: string | null
          severity?: string
          status?: string | null
          suspension_end_date?: string | null
          suspension_start_date?: string | null
          type?: string
          updated_at?: string | null
          visible_to_employee?: boolean | null
          workflow_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          account_no: string
          avatar: string | null
          bank_name: string
          created_at: string
          department: string
          employee_code: string | null
          end_date: string
          exclude_from_onboarding: boolean
          firstname: string
          id: string
          monthly_salaries: Json
          no_of_guarantors: number | null
          offboarding_tasks: Json | null
          onboarding_checklist: Json | null
          onboarding_tasks: Json | null
          paye_number: string | null
          paye_tax: boolean
          pension_number: string
          position: string
          probation_period: number | null
          rent: number
          staff_type: string
          start_date: string
          status: string
          surname: string
          tax_id: string
          tentative_start_date: string | null
          verified_start_date: string | null
          withholding_tax: boolean
          yearly_leave: number
        }
        Insert: {
          account_no?: string
          avatar?: string | null
          bank_name?: string
          created_at?: string
          department: string
          employee_code?: string | null
          end_date?: string
          exclude_from_onboarding?: boolean
          firstname: string
          id?: string
          monthly_salaries?: Json
          no_of_guarantors?: number | null
          offboarding_tasks?: Json | null
          onboarding_checklist?: Json | null
          onboarding_tasks?: Json | null
          paye_number?: string | null
          paye_tax?: boolean
          pension_number?: string
          position?: string
          probation_period?: number | null
          rent?: number
          staff_type?: string
          start_date?: string
          status?: string
          surname: string
          tax_id?: string
          tentative_start_date?: string | null
          verified_start_date?: string | null
          withholding_tax?: boolean
          yearly_leave?: number
        }
        Update: {
          account_no?: string
          avatar?: string | null
          bank_name?: string
          created_at?: string
          department?: string
          employee_code?: string | null
          end_date?: string
          exclude_from_onboarding?: boolean
          firstname?: string
          id?: string
          monthly_salaries?: Json
          no_of_guarantors?: number | null
          offboarding_tasks?: Json | null
          onboarding_checklist?: Json | null
          onboarding_tasks?: Json | null
          paye_number?: string | null
          paye_tax?: boolean
          pension_number?: string
          position?: string
          probation_period?: number | null
          rent?: number
          staff_type?: string
          start_date?: string
          status?: string
          surname?: string
          tax_id?: string
          tentative_start_date?: string | null
          verified_start_date?: string | null
          withholding_tax?: boolean
          yearly_leave?: number
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          acknowledged: boolean | null
          created_at: string | null
          created_by: string | null
          date: string
          employee_comment: string | null
          employee_id: string | null
          id: string
          manager_notes: string | null
          overall_score: number | null
          scores: Json | null
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          created_at?: string | null
          created_by?: string | null
          date: string
          employee_comment?: string | null
          employee_id?: string | null
          id: string
          manager_notes?: string | null
          overall_score?: number | null
          scores?: Json | null
          status?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          employee_comment?: string | null
          employee_id?: string | null
          id?: string
          manager_notes?: string | null
          overall_score?: number | null
          scores?: Json | null
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          billing_cycle: string
          client: string
          created_at: string
          daily_rental_cost: number | null
          daily_usage: number | null
          damages: number | null
          date: string
          diesel_cost: number | null
          diesel_cost_per_ltr: number | null
          due_date: string
          duration: number | null
          id: string
          installation: number | null
          invoice_number: string
          mob_demob: number | null
          no_of_machine: number | null
          no_of_technician: number | null
          project: string
          reminder_date: string
          rental_cost: number | null
          site_id: string
          site_name: string
          status: string
          technicians_cost: number | null
          technicians_daily_rate: number | null
          total_charge: number | null
          total_cost: number | null
          total_exclusive_of_vat: number | null
          vat: number | null
          vat_inc: string | null
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          client: string
          created_at?: string
          daily_rental_cost?: number | null
          daily_usage?: number | null
          damages?: number | null
          date?: string
          diesel_cost?: number | null
          diesel_cost_per_ltr?: number | null
          due_date?: string
          duration?: number | null
          id?: string
          installation?: number | null
          invoice_number?: string
          mob_demob?: number | null
          no_of_machine?: number | null
          no_of_technician?: number | null
          project?: string
          reminder_date?: string
          rental_cost?: number | null
          site_id?: string
          site_name?: string
          status?: string
          technicians_cost?: number | null
          technicians_daily_rate?: number | null
          total_charge?: number | null
          total_cost?: number | null
          total_exclusive_of_vat?: number | null
          vat?: number | null
          vat_inc?: string | null
        }
        Update: {
          amount?: number
          billing_cycle?: string
          client?: string
          created_at?: string
          daily_rental_cost?: number | null
          daily_usage?: number | null
          damages?: number | null
          date?: string
          diesel_cost?: number | null
          diesel_cost_per_ltr?: number | null
          due_date?: string
          duration?: number | null
          id?: string
          installation?: number | null
          invoice_number?: string
          mob_demob?: number | null
          no_of_machine?: number | null
          no_of_technician?: number | null
          project?: string
          reminder_date?: string
          rental_cost?: number | null
          site_id?: string
          site_name?: string
          status?: string
          technicians_cost?: number | null
          technicians_daily_rate?: number | null
          total_charge?: number | null
          total_cost?: number | null
          total_exclusive_of_vat?: number | null
          vat?: number | null
          vat_inc?: string | null
        }
        Relationships: []
      }
      leave_types: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      leaves: {
        Row: {
          can_be_contacted: string
          created_at: string
          date_returned: string
          duration: number
          employee_id: string
          employee_name: string
          expected_end_date: string
          id: string
          leave_type: string
          management: string | null
          reason: string
          start_date: string
          status: string
          supervisor: string | null
          uploaded_file: string | null
          uploaded_file_name: string | null
        }
        Insert: {
          can_be_contacted?: string
          created_at?: string
          date_returned?: string
          duration?: number
          employee_id: string
          employee_name?: string
          expected_end_date?: string
          id?: string
          leave_type?: string
          management?: string | null
          reason?: string
          start_date?: string
          status?: string
          supervisor?: string | null
          uploaded_file?: string | null
          uploaded_file_name?: string | null
        }
        Update: {
          can_be_contacted?: string
          created_at?: string
          date_returned?: string
          duration?: number
          employee_id?: string
          employee_name?: string
          expected_end_date?: string
          id?: string
          leave_type?: string
          management?: string | null
          reason?: string
          start_date?: string
          status?: string
          supervisor?: string | null
          uploaded_file?: string | null
          uploaded_file_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_banks: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      ledger_categories: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          bank: string | null
          category: string
          client: string | null
          created_at: string | null
          date: string
          description: string | null
          entered_by: string
          id: string
          site: string | null
          updated_at: string | null
          vendor: string | null
          voucher_no: string
        }
        Insert: {
          amount: number
          bank?: string | null
          category: string
          client?: string | null
          created_at?: string | null
          date: string
          description?: string | null
          entered_by: string
          id?: string
          site?: string | null
          updated_at?: string | null
          vendor?: string | null
          voucher_no: string
        }
        Update: {
          amount?: number
          bank?: string | null
          category?: string
          client?: string | null
          created_at?: string | null
          date?: string
          description?: string | null
          entered_by?: string
          id?: string
          site?: string | null
          updated_at?: string | null
          vendor?: string | null
          voucher_no?: string
        }
        Relationships: []
      }
      ledger_vendors: {
        Row: {
          id: string
          name: string
          tin_number: string | null
        }
        Insert: {
          id?: string
          name: string
          tin_number?: string | null
        }
        Update: {
          id?: string
          name?: string
          tin_number?: string | null
        }
        Relationships: []
      }
      loans: {
        Row: {
          created_at: string
          duration: number
          employee_id: string
          employee_name: string
          id: string
          loan_type: string
          monthly_deduction: number
          payment_start_date: string
          principal_amount: number
          remaining_balance: number
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          duration?: number
          employee_id: string
          employee_name?: string
          id?: string
          loan_type?: string
          monthly_deduction?: number
          payment_start_date?: string
          principal_amount?: number
          remaining_balance?: number
          start_date?: string
          status?: string
        }
        Update: {
          created_at?: string
          duration?: number
          employee_id?: string
          employee_name?: string
          id?: string
          loan_type?: string
          monthly_deduction?: number
          payment_start_date?: string
          principal_amount?: number
          remaining_balance?: number
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      main_tasks: {
        Row: {
          assigned_to: string | null
          assignedTo: string | null
          created_at: string | null
          created_by: string | null
          createdBy: string | null
          deadline: string | null
          description: string | null
          id: string
          is_deleted: boolean | null
          priority: string | null
          teamId: string | null
          title: string | null
          updated_at: string | null
          workspaceId: string | null
        }
        Insert: {
          assigned_to?: string | null
          assignedTo?: string | null
          created_at?: string | null
          created_by?: string | null
          createdBy?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean | null
          priority?: string | null
          teamId?: string | null
          title?: string | null
          updated_at?: string | null
          workspaceId?: string | null
        }
        Update: {
          assigned_to?: string | null
          assignedTo?: string | null
          created_at?: string | null
          created_by?: string | null
          createdBy?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          is_deleted?: boolean | null
          priority?: string | null
          teamId?: string | null
          title?: string | null
          updated_at?: string | null
          workspaceId?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_for_vat: number
          client: string
          created_at: string
          date: string
          discount: number
          id: string
          pay_vat: string
          site: string
          vat: number
          withholding_tax: number
        }
        Insert: {
          amount?: number
          amount_for_vat?: number
          client: string
          created_at?: string
          date?: string
          discount?: number
          id?: string
          pay_vat?: string
          site?: string
          vat?: number
          withholding_tax?: number
        }
        Update: {
          amount?: number
          amount_for_vat?: number
          client?: string
          created_at?: string
          date?: string
          discount?: number
          id?: string
          pay_vat?: string
          site?: string
          vat?: number
          withholding_tax?: number
        }
        Relationships: []
      }
      pending_invoices: {
        Row: {
          client: string
          created_at: string
          daily_rental_cost: number
          daily_usage: number
          damages: number
          diesel_cost: number
          diesel_cost_per_ltr: number
          duration: number
          end_date: string
          id: string
          installation: number
          invoice_no: string
          mob_demob: number
          no_of_machine: number
          no_of_technician: number
          rental_cost: number
          site: string
          start_date: string
          technicians_cost: number
          technicians_daily_rate: number
          total_charge: number
          total_cost: number
          total_exclusive_of_vat: number
          vat: number
          vat_inc: string
        }
        Insert: {
          client: string
          created_at?: string
          daily_rental_cost?: number
          daily_usage?: number
          damages?: number
          diesel_cost?: number
          diesel_cost_per_ltr?: number
          duration?: number
          end_date?: string
          id?: string
          installation?: number
          invoice_no?: string
          mob_demob?: number
          no_of_machine?: number
          no_of_technician?: number
          rental_cost?: number
          site?: string
          start_date?: string
          technicians_cost?: number
          technicians_daily_rate?: number
          total_charge?: number
          total_cost?: number
          total_exclusive_of_vat?: number
          vat?: number
          vat_inc?: string
        }
        Update: {
          client?: string
          created_at?: string
          daily_rental_cost?: number
          daily_usage?: number
          damages?: number
          diesel_cost?: number
          diesel_cost_per_ltr?: number
          duration?: number
          end_date?: string
          id?: string
          installation?: number
          invoice_no?: string
          mob_demob?: number
          no_of_machine?: number
          no_of_technician?: number
          rental_cost?: number
          site?: string
          start_date?: string
          technicians_cost?: number
          technicians_daily_rate?: number
          total_charge?: number
          total_cost?: number
          total_exclusive_of_vat?: number
          vat?: number
          vat_inc?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      privilege_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          privileges: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          privileges?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          privileges?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          privileges: Json
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email?: string
          id: string
          is_active?: boolean
          name?: string
          privileges?: Json
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          privileges?: Json
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          body: string | null
          created_at: string | null
          created_by: string | null
          end_at: string | null
          frequency: string
          id: string
          is_active: boolean | null
          main_task_id: string | null
          recipient_ids: string[] | null
          remind_at: string
          send_email: boolean | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          main_task_id?: string | null
          recipient_ids?: string[] | null
          remind_at: string
          send_email?: boolean | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          main_task_id?: string | null
          recipient_ids?: string[] | null
          remind_at?: string
          send_email?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_main_task_id_fkey"
            columns: ["main_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_advances: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          employee_name: string
          id: string
          request_date: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          employee_id: string
          employee_name?: string
          id?: string
          request_date?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          employee_name?: string
          id?: string
          request_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          client: string
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          vat: string
        }
        Insert: {
          client: string
          created_at?: string
          end_date?: string
          id?: string
          name: string
          start_date?: string
          status?: string
          vat?: string
        }
        Update: {
          client?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          vat?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          approvedBy: string | null
          assigned_to: string | null
          assignedTo: string | null
          created_at: string | null
          deadline: string | null
          description: string | null
          id: string
          main_task_id: string | null
          mainTaskId: string | null
          pendingApprovalSince: string | null
          priority: string | null
          rejectedAt: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          workspaceId: string | null
        }
        Insert: {
          approvedBy?: string | null
          assigned_to?: string | null
          assignedTo?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          main_task_id?: string | null
          mainTaskId?: string | null
          pendingApprovalSince?: string | null
          priority?: string | null
          rejectedAt?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          workspaceId?: string | null
        }
        Update: {
          approvedBy?: string | null
          assigned_to?: string | null
          assignedTo?: string | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          id?: string
          main_task_id?: string | null
          mainTaskId?: string | null
          pendingApprovalSince?: string | null
          priority?: string | null
          rejectedAt?: string | null
          status?: string | null
          title?: string | null
          updated_at?: string | null
          workspaceId?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_main_task_id_fkey"
            columns: ["main_task_id"]
            isOneToOne: false
            referencedRelation: "main_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          author_id: string | null
          created_at: string | null
          id: string
          main_task_id: string | null
          subtask_id: string | null
          task_id: string | null
          text: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string | null
          id?: string
          main_task_id?: string | null
          subtask_id?: string | null
          task_id?: string | null
          text: string
        }
        Update: {
          author_id?: string | null
          created_at?: string | null
          id?: string
          main_task_id?: string | null
          subtask_id?: string | null
          task_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          site_id: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          site_id?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          site_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      vat_payments: {
        Row: {
          amount: number
          client: string
          created_at: string
          date: string
          id: string
          month: string
        }
        Insert: {
          amount?: number
          client: string
          created_at?: string
          date?: string
          id?: string
          month?: string
        }
        Update: {
          amount?: number
          client?: string
          created_at?: string
          date?: string
          id?: string
          month?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const


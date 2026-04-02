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
      activities: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          entity: string
          entity_id: string | null
          id: string
          timestamp: string
          updated_at: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          entity: string
          entity_id?: string | null
          id: string
          timestamp: string
          updated_at?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          entity?: string
          entity_id?: string | null
          id?: string
          timestamp?: string
          updated_at?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_reg_number: string | null
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
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_reg_number?: string | null
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
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_reg_number?: string | null
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
      assets: {
        Row: {
          available_quantity: number | null
          category: string | null
          condition: string | null
          cost: number | null
          created_at: string | null
          critical_stock_level: number | null
          damaged_count: number | null
          deployment_date: string | null
          description: string | null
          electricity_consumption: number | null
          fuel_capacity: number | null
          fuel_consumption_rate: number | null
          id: string
          location: string | null
          low_stock_level: number | null
          missing_count: number | null
          model: string | null
          name: string
          power_source: string | null
          purchase_date: string | null
          quantity: number
          requires_logging: boolean | null
          reserved_quantity: number | null
          serial_number: string | null
          service: string | null
          service_interval: number | null
          site_id: string | null
          site_quantities: string | null
          status: string | null
          type: string | null
          unit_of_measurement: string
          updated_at: string | null
          used_count: number | null
        }
        Insert: {
          available_quantity?: number | null
          category?: string | null
          condition?: string | null
          cost?: number | null
          created_at?: string | null
          critical_stock_level?: number | null
          damaged_count?: number | null
          deployment_date?: string | null
          description?: string | null
          electricity_consumption?: number | null
          fuel_capacity?: number | null
          fuel_consumption_rate?: number | null
          id?: string
          location?: string | null
          low_stock_level?: number | null
          missing_count?: number | null
          model?: string | null
          name: string
          power_source?: string | null
          purchase_date?: string | null
          quantity?: number
          requires_logging?: boolean | null
          reserved_quantity?: number | null
          serial_number?: string | null
          service?: string | null
          service_interval?: number | null
          site_id?: string | null
          site_quantities?: string | null
          status?: string | null
          type?: string | null
          unit_of_measurement: string
          updated_at?: string | null
          used_count?: number | null
        }
        Update: {
          available_quantity?: number | null
          category?: string | null
          condition?: string | null
          cost?: number | null
          created_at?: string | null
          critical_stock_level?: number | null
          damaged_count?: number | null
          deployment_date?: string | null
          description?: string | null
          electricity_consumption?: number | null
          fuel_capacity?: number | null
          fuel_consumption_rate?: number | null
          id?: string
          location?: string | null
          low_stock_level?: number | null
          missing_count?: number | null
          model?: string | null
          name?: string
          power_source?: string | null
          purchase_date?: string | null
          quantity?: number
          requires_logging?: boolean | null
          reserved_quantity?: number | null
          serial_number?: string | null
          service?: string | null
          service_interval?: number | null
          site_id?: string | null
          site_quantities?: string | null
          status?: string | null
          type?: string | null
          unit_of_measurement?: string
          updated_at?: string | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
      audit_logs: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
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
      comm_logs: {
        Row: {
          channel: string
          client: string | null
          contact_person: string | null
          contact_type: string
          created_at: string
          date: string
          direction: string
          follow_up_date: string | null
          follow_up_done: boolean
          id: string
          logged_by: string
          notes: string
          outcome: string | null
          site_id: string | null
          site_name: string | null
          subject: string | null
          time: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          client?: string | null
          contact_person?: string | null
          contact_type: string
          created_at?: string
          date: string
          direction: string
          follow_up_date?: string | null
          follow_up_done?: boolean
          id?: string
          logged_by?: string
          notes?: string
          outcome?: string | null
          site_id?: string | null
          site_name?: string | null
          subject?: string | null
          time?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          client?: string | null
          contact_person?: string | null
          contact_type?: string
          created_at?: string
          date?: string
          direction?: string
          follow_up_date?: string | null
          follow_up_done?: boolean
          id?: string
          logged_by?: string
          notes?: string
          outcome?: string | null
          site_id?: string | null
          site_name?: string | null
          subject?: string | null
          time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_expenses: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          description: string
          entered_by: string
          id: string
          paid_from: string
          paid_to_account_no: string
          paid_to_bank_name: string
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          description: string
          entered_by: string
          id?: string
          paid_from: string
          paid_to_account_no: string
          paid_to_bank_name: string
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          description?: string
          entered_by?: string
          id?: string
          paid_from?: string
          paid_to_account_no?: string
          paid_to_bank_name?: string
          status?: string | null
        }
        Relationships: []
      }
      consumable_logs: {
        Row: {
          consumable_id: string
          consumable_name: string
          created_at: string | null
          date: string
          id: string
          notes: string | null
          quantity_remaining: number
          quantity_used: number
          site_id: string
          unit: string
          updated_at: string | null
          used_by: string
          used_for: string
        }
        Insert: {
          consumable_id: string
          consumable_name: string
          created_at?: string | null
          date: string
          id: string
          notes?: string | null
          quantity_remaining: number
          quantity_used: number
          site_id: string
          unit: string
          updated_at?: string | null
          used_by: string
          used_for: string
        }
        Update: {
          consumable_id?: string
          consumable_name?: string
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          quantity_remaining?: number
          quantity_used?: number
          site_id?: string
          unit?: string
          updated_at?: string | null
          used_by?: string
          used_for?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumable_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
          parent_department_id: string | null
          staff_type: string | null
          work_days_per_week: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_department_id?: string | null
          staff_type?: string | null
          work_days_per_week?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_department_id?: string | null
          staff_type?: string | null
          work_days_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
          points: number | null
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
          points?: number | null
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
          points?: number | null
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
          delisted_date: string | null
          department: string
          email: string | null
          employee_code: string | null
          end_date: string
          exclude_from_onboarding: boolean
          firstname: string
          id: string
          lashma_expiry_date: string | null
          lashma_policy_number: string | null
          lashma_registration_date: string | null
          level: number | null
          line_manager: string | null
          monthly_salaries: Json
          no_of_guarantors: number | null
          offboarding_tasks: Json | null
          onboarding_checklist: Json | null
          onboarding_main_task_id: string | null
          onboarding_suspended: boolean | null
          onboarding_tasks: Json | null
          paye_number: string | null
          paye_tax: boolean
          payee_type: string | null
          pension_number: string
          phone: string | null
          position: string
          probation_period: number | null
          rent: number
          secondary_departments: string[] | null
          staff_type: string
          start_date: string
          start_month_of_pay: string | null
          status: string
          surname: string
          tax_id: string
          tentative_start_date: string | null
          type_of_pay: string | null
          verified_start_date: string | null
          withholding_tax: boolean
          withholding_tax_rate: number | null
          yearly_leave: number
        }
        Insert: {
          account_no?: string
          avatar?: string | null
          bank_name?: string
          created_at?: string
          delisted_date?: string | null
          department: string
          email?: string | null
          employee_code?: string | null
          end_date?: string
          exclude_from_onboarding?: boolean
          firstname: string
          id?: string
          lashma_expiry_date?: string | null
          lashma_policy_number?: string | null
          lashma_registration_date?: string | null
          level?: number | null
          line_manager?: string | null
          monthly_salaries?: Json
          no_of_guarantors?: number | null
          offboarding_tasks?: Json | null
          onboarding_checklist?: Json | null
          onboarding_main_task_id?: string | null
          onboarding_suspended?: boolean | null
          onboarding_tasks?: Json | null
          paye_number?: string | null
          paye_tax?: boolean
          payee_type?: string | null
          pension_number?: string
          phone?: string | null
          position?: string
          probation_period?: number | null
          rent?: number
          secondary_departments?: string[] | null
          staff_type?: string
          start_date?: string
          start_month_of_pay?: string | null
          status?: string
          surname: string
          tax_id?: string
          tentative_start_date?: string | null
          type_of_pay?: string | null
          verified_start_date?: string | null
          withholding_tax?: boolean
          withholding_tax_rate?: number | null
          yearly_leave?: number
        }
        Update: {
          account_no?: string
          avatar?: string | null
          bank_name?: string
          created_at?: string
          delisted_date?: string | null
          department?: string
          email?: string | null
          employee_code?: string | null
          end_date?: string
          exclude_from_onboarding?: boolean
          firstname?: string
          id?: string
          lashma_expiry_date?: string | null
          lashma_policy_number?: string | null
          lashma_registration_date?: string | null
          level?: number | null
          line_manager?: string | null
          monthly_salaries?: Json
          no_of_guarantors?: number | null
          offboarding_tasks?: Json | null
          onboarding_checklist?: Json | null
          onboarding_main_task_id?: string | null
          onboarding_suspended?: boolean | null
          onboarding_tasks?: Json | null
          paye_number?: string | null
          paye_tax?: boolean
          payee_type?: string | null
          pension_number?: string
          phone?: string | null
          position?: string
          probation_period?: number | null
          rent?: number
          secondary_departments?: string[] | null
          staff_type?: string
          start_date?: string
          start_month_of_pay?: string | null
          status?: string
          surname?: string
          tax_id?: string
          tentative_start_date?: string | null
          type_of_pay?: string | null
          verified_start_date?: string | null
          withholding_tax?: boolean
          withholding_tax_rate?: number | null
          yearly_leave?: number
        }
        Relationships: []
      }
      equipment_logs: {
        Row: {
          active: boolean | null
          client_feedback: string | null
          created_at: string | null
          date: string
          diesel_entered: number | null
          downtime_entries: Json | null
          equipment_id: string
          equipment_name: string
          id: string
          issues_on_site: string | null
          maintenance_details: string | null
          site_id: string
          supervisor_on_site: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          client_feedback?: string | null
          created_at?: string | null
          date: string
          diesel_entered?: number | null
          downtime_entries?: Json | null
          equipment_id: string
          equipment_name: string
          id?: string
          issues_on_site?: string | null
          maintenance_details?: string | null
          site_id: string
          supervisor_on_site?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          client_feedback?: string | null
          created_at?: string | null
          date?: string
          diesel_entered?: number | null
          downtime_entries?: Json | null
          equipment_id?: string
          equipment_name?: string
          id?: string
          issues_on_site?: string | null
          maintenance_details?: string | null
          site_id?: string
          supervisor_on_site?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_logs_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_logs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
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
      incident_log: {
        Row: {
          corrective_action: string | null
          created_at: string | null
          description: string
          id: string
          incident_date: string
          incident_type: string
          persons_involved: string | null
          reported_by_id: string | null
          reported_by_name: string | null
          site_id: string | null
          site_name: string | null
          status: string | null
          vehicle_id: string | null
          workspace_id: string
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string | null
          description: string
          id?: string
          incident_date: string
          incident_type: string
          persons_involved?: string | null
          reported_by_id?: string | null
          reported_by_name?: string | null
          site_id?: string | null
          site_name?: string | null
          status?: string | null
          vehicle_id?: string | null
          workspace_id?: string
        }
        Update: {
          corrective_action?: string | null
          created_at?: string | null
          description?: string
          id?: string
          incident_date?: string
          incident_type?: string
          persons_involved?: string | null
          reported_by_id?: string | null
          reported_by_name?: string | null
          site_id?: string | null
          site_name?: string | null
          status?: string | null
          vehicle_id?: string | null
          workspace_id?: string
        }
        Relationships: []
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
          approval_status: string | null
          approval_task_id: string | null
          approved_at: string | null
          approved_by_id: string | null
          approved_by_name: string | null
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
          rejection_note: string | null
          start_date: string
          status: string
          supervisor: string | null
          uploaded_file: string | null
          uploaded_file_name: string | null
        }
        Insert: {
          approval_status?: string | null
          approval_task_id?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          approved_by_name?: string | null
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
          rejection_note?: string | null
          start_date?: string
          status?: string
          supervisor?: string | null
          uploaded_file?: string | null
          uploaded_file_name?: string | null
        }
        Update: {
          approval_status?: string | null
          approval_task_id?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          approved_by_name?: string | null
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
          rejection_note?: string | null
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
      ledger_beneficiary_banks: {
        Row: {
          account_no: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          account_no: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          account_no?: string
          created_at?: string | null
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
          approval_task_id: string | null
          approved_at: string | null
          approved_by_id: string | null
          approved_by_name: string | null
          created_at: string
          duration: number
          employee_id: string
          employee_name: string
          id: string
          loan_type: string
          monthly_deduction: number
          payment_start_date: string
          principal_amount: number
          rejection_note: string | null
          remaining_balance: number
          start_date: string
          status: string
        }
        Insert: {
          approval_task_id?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          approved_by_name?: string | null
          created_at?: string
          duration?: number
          employee_id: string
          employee_name?: string
          id?: string
          loan_type?: string
          monthly_deduction?: number
          payment_start_date?: string
          principal_amount?: number
          rejection_note?: string | null
          remaining_balance?: number
          start_date?: string
          status?: string
        }
        Update: {
          approval_task_id?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          approved_by_name?: string | null
          created_at?: string
          duration?: number
          employee_id?: string
          employee_name?: string
          id?: string
          loan_type?: string
          monthly_deduction?: number
          payment_start_date?: string
          principal_amount?: number
          rejection_note?: string | null
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
          is_project: boolean | null
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
          is_project?: boolean | null
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
          is_project?: boolean | null
          priority?: string | null
          teamId?: string | null
          title?: string | null
          updated_at?: string | null
          workspaceId?: string | null
        }
        Relationships: []
      }
      maintenance_logs: {
        Row: {
          asset_id: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          machine_hours: number | null
          maintenance_type: string
          next_service_date: string | null
          performed_by: string | null
          service_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asset_id?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          machine_hours?: number | null
          maintenance_type: string
          next_service_date?: string | null
          performed_by?: string | null
          service_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          machine_hours?: number | null
          maintenance_type?: string
          next_service_date?: string | null
          performed_by?: string | null
          service_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_logs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_snapshots: {
        Row: {
          created_at: string | null
          id: string
          low_stock: number | null
          out_of_stock: number | null
          outstanding_checkouts: number | null
          outstanding_waybills: number | null
          snapshot_date: string
          total_assets: number | null
          total_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          low_stock?: number | null
          out_of_stock?: number | null
          outstanding_checkouts?: number | null
          outstanding_waybills?: number | null
          snapshot_date: string
          total_assets?: number | null
          total_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          low_stock?: number | null
          out_of_stock?: number | null
          outstanding_checkouts?: number | null
          outstanding_waybills?: number | null
          snapshot_date?: string
          total_assets?: number | null
          total_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      op_company_settings: {
        Row: {
          address: string
          ai_config: string | null
          company_name: string
          created_at: string | null
          currency: string | null
          date_format: string | null
          email: string
          id: string
          logo: string | null
          notifications_email: boolean | null
          notifications_push: boolean | null
          phone: string
          theme: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address: string
          ai_config?: string | null
          company_name: string
          created_at?: string | null
          currency?: string | null
          date_format?: string | null
          email: string
          id?: string
          logo?: string | null
          notifications_email?: boolean | null
          notifications_push?: boolean | null
          phone: string
          theme?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string
          ai_config?: string | null
          company_name?: string
          created_at?: string | null
          currency?: string | null
          date_format?: string | null
          email?: string
          id?: string
          logo?: string | null
          notifications_email?: boolean | null
          notifications_push?: boolean | null
          phone?: string
          theme?: string | null
          updated_at?: string | null
          website?: string | null
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
      pending_sites: {
        Row: {
          client_name: string
          created_at: string | null
          data: Json
          id: string
          site_name: string
          status: string
          updated_at: string | null
        }
        Insert: {
          client_name: string
          created_at?: string | null
          data: Json
          id: string
          site_name: string
          status: string
          updated_at?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string | null
          data?: Json
          id?: string
          site_name?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      permit_to_work: {
        Row: {
          created_at: string | null
          id: string
          issued_at: string | null
          issued_by_id: string | null
          issued_by_name: string | null
          notes: string | null
          site_id: string
          site_name: string
          start_date: string | null
          status: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by_id?: string | null
          issued_by_name?: string | null
          notes?: string | null
          site_id: string
          site_name: string
          start_date?: string | null
          status?: string | null
          workspace_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by_id?: string | null
          issued_by_name?: string | null
          notes?: string | null
          site_id?: string
          site_name?: string
          start_date?: string | null
          status?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
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
      project_lifecycle_task: {
        Row: {
          assigned_to_id: string | null
          assigned_to_name: string | null
          completed_at: string | null
          completed_by_id: string | null
          completed_by_name: string | null
          created_at: string | null
          deadline: string
          description: string | null
          id: string
          justification: string | null
          linked_main_task_id: string | null
          site_id: string
          site_name: string
          soil_test_findings: string | null
          status: string | null
          task_code: string
          title: string
          workspace_id: string
        }
        Insert: {
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          created_at?: string | null
          deadline: string
          description?: string | null
          id?: string
          justification?: string | null
          linked_main_task_id?: string | null
          site_id: string
          site_name: string
          soil_test_findings?: string | null
          status?: string | null
          task_code: string
          title: string
          workspace_id?: string
        }
        Update: {
          assigned_to_id?: string | null
          assigned_to_name?: string | null
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          created_at?: string | null
          deadline?: string
          description?: string | null
          id?: string
          justification?: string | null
          linked_main_task_id?: string | null
          site_id?: string
          site_name?: string
          soil_test_findings?: string | null
          status?: string | null
          task_code?: string
          title?: string
          workspace_id?: string
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
      quick_checkouts: {
        Row: {
          asset_id: string
          checkout_date: string
          created_at: string | null
          employee_id: string | null
          expected_return_days: number
          id: string
          notes: string | null
          quantity: number
          returned_quantity: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          checkout_date: string
          created_at?: string | null
          employee_id?: string | null
          expected_return_days: number
          id?: string
          notes?: string | null
          quantity: number
          returned_quantity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          checkout_date?: string
          created_at?: string | null
          employee_id?: string | null
          expected_return_days?: number
          id?: string
          notes?: string | null
          quantity?: number
          returned_quantity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_checkouts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_checkouts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
          last_sent_at: string | null
          main_task_id: string | null
          recipient_ids: string[] | null
          remind_at: string
          send_email: boolean | null
          subtask_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          main_task_id?: string | null
          recipient_ids?: string[] | null
          remind_at: string
          send_email?: boolean | null
          subtask_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          created_by?: string | null
          end_at?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          main_task_id?: string | null
          recipient_ids?: string[] | null
          remind_at?: string
          send_email?: boolean | null
          subtask_id?: string | null
          title?: string
          updated_at?: string | null
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
          {
            foreignKeyName: "reminders_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
        ]
      }
      return_bills: {
        Row: {
          condition: string | null
          created_at: string | null
          id: string
          notes: string | null
          received_by: string
          return_date: string
          status: string | null
          updated_at: string | null
          waybill_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          received_by: string
          return_date: string
          status?: string | null
          updated_at?: string | null
          waybill_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          received_by?: string
          return_date?: string
          status?: string | null
          updated_at?: string | null
          waybill_id?: string
        }
        Relationships: []
      }
      return_items: {
        Row: {
          asset_id: string
          condition: string | null
          created_at: string | null
          id: string
          quantity: number
          return_bill_id: string
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          condition?: string | null
          created_at?: string | null
          id?: string
          quantity: number
          return_bill_id: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          condition?: string | null
          created_at?: string | null
          id?: string
          quantity?: number
          return_bill_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_bill_id_fkey"
            columns: ["return_bill_id"]
            isOneToOne: false
            referencedRelation: "return_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_advances: {
        Row: {
          amount: number
          approval_task_id: string | null
          approved_at: string | null
          approved_by_id: string | null
          approved_by_name: string | null
          created_at: string
          employee_id: string
          employee_name: string
          id: string
          rejection_note: string | null
          request_date: string
          status: string
        }
        Insert: {
          amount?: number
          approval_task_id?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          approved_by_name?: string | null
          created_at?: string
          employee_id: string
          employee_name?: string
          id?: string
          rejection_note?: string | null
          request_date?: string
          status?: string
        }
        Update: {
          amount?: number
          approval_task_id?: string | null
          approved_at?: string | null
          approved_by_id?: string | null
          approved_by_name?: string | null
          created_at?: string
          employee_id?: string
          employee_name?: string
          id?: string
          rejection_note?: string | null
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
      site_transactions: {
        Row: {
          asset_id: string
          asset_name: string
          condition: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          quantity: number
          reference_id: string
          reference_type: string
          site_id: string
          transaction_type: string
          type: string
        }
        Insert: {
          asset_id: string
          asset_name: string
          condition?: string | null
          created_at: string
          created_by?: string | null
          id: string
          notes?: string | null
          quantity: number
          reference_id: string
          reference_type: string
          site_id: string
          transaction_type: string
          type: string
        }
        Update: {
          asset_id?: string
          asset_name?: string
          condition?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          reference_id?: string
          reference_type?: string
          site_id?: string
          transaction_type?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_transactions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_transactions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          client: string
          client_name: string | null
          contact_person: string | null
          created_at: string
          description: string | null
          end_date: string
          id: string
          location: string | null
          name: string
          phone: string | null
          service: string | null
          start_date: string
          status: string
          vat: string
        }
        Insert: {
          client: string
          client_name?: string | null
          contact_person?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          location?: string | null
          name: string
          phone?: string | null
          service?: string | null
          start_date?: string
          status?: string
          vat?: string
        }
        Update: {
          client?: string
          client_name?: string | null
          contact_person?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          location?: string | null
          name?: string
          phone?: string | null
          service?: string | null
          start_date?: string
          status?: string
          vat?: string
        }
        Relationships: []
      }
      staff_merit_record: {
        Row: {
          category: string
          created_at: string | null
          description: string
          employee_id: string
          employee_name: string
          hr_notified: boolean | null
          id: string
          incident_date: string
          logged_by_id: string | null
          logged_by_name: string | null
          record_type: string
          site_id: string | null
          site_name: string | null
          workspace_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          employee_id: string
          employee_name: string
          hr_notified?: boolean | null
          id?: string
          incident_date: string
          logged_by_id?: string | null
          logged_by_name?: string | null
          record_type: string
          site_id?: string | null
          site_name?: string | null
          workspace_id?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          employee_id?: string
          employee_name?: string
          hr_notified?: boolean | null
          id?: string
          incident_date?: string
          logged_by_id?: string | null
          logged_by_name?: string | null
          record_type?: string
          site_id?: string | null
          site_name?: string | null
          workspace_id?: string
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
          attachments: Json | null
          author_id: string | null
          created_at: string | null
          file_links: Json | null
          id: string
          main_task_id: string | null
          subtask_id: string | null
          task_id: string | null
          text: string
        }
        Insert: {
          attachments?: Json | null
          author_id?: string | null
          created_at?: string | null
          file_links?: Json | null
          id?: string
          main_task_id?: string | null
          subtask_id?: string | null
          task_id?: string | null
          text: string
        }
        Update: {
          attachments?: Json | null
          author_id?: string | null
          created_at?: string | null
          file_links?: Json | null
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
          year: string | null
        }
        Insert: {
          amount?: number
          client: string
          created_at?: string
          date?: string
          id?: string
          month?: string
          year?: string | null
        }
        Update: {
          amount?: number
          client?: string
          created_at?: string
          date?: string
          id?: string
          month?: string
          year?: string | null
        }
        Relationships: []
      }
      vehicle_movement_log: {
        Row: {
          arrival_time: string | null
          created_at: string | null
          created_by_id: string | null
          created_by_name: string | null
          departure_time: string
          driver_employee_id: string | null
          driver_name: string
          id: string
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          purpose: string
          route: string | null
          site_id: string | null
          site_name: string | null
          vehicle_id: string
          vehicle_reg: string | null
          workspace_id: string
        }
        Insert: {
          arrival_time?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          departure_time: string
          driver_employee_id?: string | null
          driver_name: string
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          purpose: string
          route?: string | null
          site_id?: string | null
          site_name?: string | null
          vehicle_id: string
          vehicle_reg?: string | null
          workspace_id?: string
        }
        Update: {
          arrival_time?: string | null
          created_at?: string | null
          created_by_id?: string | null
          created_by_name?: string | null
          departure_time?: string
          driver_employee_id?: string | null
          driver_name?: string
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          purpose?: string
          route?: string | null
          site_id?: string | null
          site_name?: string | null
          vehicle_id?: string
          vehicle_reg?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string | null
          id: string
          name: string
          registration_number: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          registration_number?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          registration_number?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      waybills: {
        Row: {
          created_at: string | null
          created_by: string | null
          driver_name: string | null
          expected_return_date: string | null
          id: string
          issue_date: string
          items: Json | null
          purpose: string
          return_to_site_id: string | null
          sent_to_site_date: string | null
          service: string
          site_id: string | null
          status: string | null
          type: string | null
          updated_at: string | null
          vehicle: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          driver_name?: string | null
          expected_return_date?: string | null
          id: string
          issue_date: string
          items?: Json | null
          purpose: string
          return_to_site_id?: string | null
          sent_to_site_date?: string | null
          service: string
          site_id?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          vehicle?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          driver_name?: string | null
          expected_return_date?: string | null
          id?: string
          issue_date?: string
          items?: Json | null
          purpose?: string
          return_to_site_id?: string | null
          sent_to_site_date?: string | null
          service?: string
          site_id?: string | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
          vehicle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waybills_return_to_site_id_fkey"
            columns: ["return_to_site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_attendance_records_by_ids: {
        Args: { record_ids: string[] }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
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
